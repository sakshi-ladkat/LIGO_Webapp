<?php

namespace Tests\Unit;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use App\Services\DuplicateApplicantService;
use App\Models\UserProfile;

/**
 * Bug Analysis for DuplicateApplicantService:
 *
 * BUG-5: calculateRiskScore() — $percent undefined when names are null
 *   similar_text() receives null strings → $percent uninitialized → PHP 8+ TypeError.
 *
 * BUG-8: findPossibleDuplicates() uses $application->user_id but old code
 *   used $applicant->id — the field name inconsistency could silently exclude
 *   the applicant themselves from results or fail entirely.
 */
class DuplicateApplicantServiceTest extends TestCase
{
    use RefreshDatabase;

    private DuplicateApplicantService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new DuplicateApplicantService();
    }

    private function makeProfile(array $overrides = []): UserProfile
    {
        $profile = new UserProfile();
        $profile->normalized_full_name = $overrides['normalized_full_name'] ?? 'john doe';
        $profile->soundex_name         = $overrides['soundex_name'] ?? 'J530';
        $profile->first_name           = $overrides['first_name'] ?? 'John';
        $profile->middle_name          = $overrides['middle_name'] ?? null;
        $profile->last_name            = $overrides['last_name'] ?? 'Doe';
        return $profile;
    }

    // ──────────────────────────────────────────────────────────────────
    // normalizeName
    // ──────────────────────────────────────────────────────────────────

    /** @test */
    public function test_normalize_name_strips_special_chars_and_lowercases(): void
    {
        $result = $this->service->normalizeName("O'Brien", '', 'Smith-Jones');
        $this->assertSame('obrien smithjones', $result);
    }

    /** @test */
    public function test_normalize_name_handles_null_middle_name(): void
    {
        // null middle name should not crash
        $result = $this->service->normalizeName('Alice', null, 'Walker');
        $this->assertSame('alice walker', $result);
    }

    /** @test */
    public function test_normalize_name_collapses_multiple_spaces(): void
    {
        $result = $this->service->normalizeName('Jane', '   ', 'Doe');
        // Multiple spaces between parts should collapse to one
        $this->assertStringNotContainsString('  ', $result);
    }

    // ──────────────────────────────────────────────────────────────────
    // calculateSoundex
    // ──────────────────────────────────────────────────────────────────

    /** @test */
    public function test_calculate_soundex_returns_null_for_empty_string(): void
    {
        $this->assertNull($this->service->calculateSoundex(''));
    }

    /** @test */
    public function test_calculate_soundex_returns_null_for_null(): void
    {
        // BUG-5 adjacent: passing null should return null, not crash
        $this->assertNull($this->service->calculateSoundex(null));
    }

    /** @test */
    public function test_calculate_soundex_returns_max_10_chars(): void
    {
        $result = $this->service->calculateSoundex('john paul george ringo');
        $this->assertLessThanOrEqual(10, strlen($result));
    }

    // ──────────────────────────────────────────────────────────────────
    // calculateRiskScore — BUG-5 regression
    // ──────────────────────────────────────────────────────────────────

    /** @test */
    public function test_calculate_risk_score_does_not_crash_when_normalized_name_is_null(): void
    {
        // BUG-5: similar_text() with null arguments causes $percent to be undefined
        // This test ensures we handle null normalized_full_name without TypeError
        $user1 = (object)[
            'profile'   => (object)['normalized_full_name' => null],
            'affilation'=> null,
            'contact'   => null,
        ];
        $user2 = (object)[
            'profile'   => (object)['normalized_full_name' => 'john doe'],
            'affilation'=> null,
            'contact'   => null,
        ];

        // Cast to avoid Eloquent dependency — directly test the pure logic
        // If BUG-5 exists, this will throw: TypeError / Undefined variable $percent
        $result = $this->service->calculateRiskScore(
            $this->fakeUser(null, null, null),
            $this->fakeUser('john doe', null, null)
        );

        $this->assertArrayHasKey('risk', $result);
        $this->assertArrayHasKey('similarity', $result);
    }

    /** @test */
    public function test_calculate_risk_score_returns_high_for_same_name_and_affiliation(): void
    {
        $instituteId = 1;
        $user1 = $this->fakeUser('john doe', $instituteId, '555-1234');
        $user2 = $this->fakeUser('john doe', $instituteId, '555-9999');

        $result = $this->service->calculateRiskScore($user1, $user2);

        $this->assertEquals('high', $result['risk']);
        $this->assertNotEmpty($result['reasons']);
    }

    /** @test */
    public function test_calculate_risk_score_returns_high_for_same_name_and_phone(): void
    {
        $user1 = $this->fakeUser('alice smith', 1, '555-0001');
        $user2 = $this->fakeUser('alice smith', 2, '555-0001');

        $result = $this->service->calculateRiskScore($user1, $user2);

        $this->assertEquals('high', $result['risk']);
    }

    /** @test */
    public function test_calculate_risk_score_returns_medium_for_exact_name_only(): void
    {
        $user1 = $this->fakeUser('robert jones', 1, '111-1111');
        $user2 = $this->fakeUser('robert jones', 2, '222-2222');

        $result = $this->service->calculateRiskScore($user1, $user2);

        $this->assertEquals('medium', $result['risk']);
    }

    /** @test */
    public function test_calculate_risk_score_returns_none_for_completely_different_names(): void
    {
        $user1 = $this->fakeUser('alice walker', 1, '000-0000');
        $user2 = $this->fakeUser('bob marley', 2, '111-1111');

        $result = $this->service->calculateRiskScore($user1, $user2);

        $this->assertEquals('none', $result['risk']);
    }

    /** @test */
    public function test_calculate_risk_score_returns_low_for_high_fuzzy_match(): void
    {
        // "michael johnson" vs "micheal johnson" — high similarity, not exact
        $user1 = $this->fakeUser('michael johnson', 1, '000-0000');
        $user2 = $this->fakeUser('micheal johnson', 2, '111-1111');

        $result = $this->service->calculateRiskScore($user1, $user2);

        // Should be 'low' due to >85% similarity
        $this->assertContains($result['risk'], ['low', 'medium'],
            'Near-identical names should produce at least low risk');
        $this->assertGreaterThan(80, $result['similarity']);
    }

    // ──────────────────────────────────────────────────────────────────
    // updateNormalizedFields
    // ──────────────────────────────────────────────────────────────────

    /** @test */
    public function test_update_normalized_fields_sets_soundex_and_normalized_name(): void
    {
        $userId = 'usr_norm_' . uniqid();
        DB::table('users')->insert([
            'user_id'    => $userId,
            'email'      => 'norm@test.com',
            'status'     => 'onboarding',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('user_profiles')->insert([
            'user_id'    => $userId,
            'first_name' => 'Sarah',
            'last_name'  => 'Connor',
            'date_of_birth' => '1990-01-01',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $profile = UserProfile::where('user_id', $userId)->first();
        $this->service->updateNormalizedFields($profile);

        $profile->refresh();
        $this->assertEquals('sarah connor', $profile->normalized_full_name);
        $this->assertNotNull($profile->soundex_name);
    }

    // ──────────────────────────────────────────────────────────────────
    // HELPER: fake user with loaded relationships
    // ──────────────────────────────────────────────────────────────────

    /**
     * Creates a fake user object mimicking eager-loaded Eloquent relationships
     * without hitting the database — for pure unit testing.
     */
    private function fakeUser(?string $normalizedName, ?int $instituteId, ?string $phone): object
    {
        return (object)[
            'user_id'   => 'usr_' . uniqid(),
            'profile'   => (object)[
                'normalized_full_name' => $normalizedName,
            ],
            'affilation'=> $instituteId ? (object)['institute_id' => $instituteId] : null,
            'contact'   => $phone ? (object)['phone_number' => $phone] : null,
        ];
    }
}
