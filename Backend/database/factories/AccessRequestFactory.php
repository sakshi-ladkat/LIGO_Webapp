<?php

namespace Database\Factories;

use App\Models\AccessRequest;
use App\Models\User;
use App\Models\Institute;
use Illuminate\Database\Eloquent\Factories\Factory;

class AccessRequestFactory extends Factory
{
    protected $model = AccessRequest::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'institute_id' => Institute::inRandomOrder()->first()?->id,
            'system_name' => fake()->randomElement(['LIGO-India Tier-1 Data Center (LIT1DC)', 'LIGO-India Control Room']),
            'services' => json_encode([fake()->word(), fake()->word()]),
            'start_date' => fake()->dateTimeBetween('-1 month', 'now')->format('Y-m-d'),
            'end_date' => fake()->dateTimeBetween('now', '+6 months')->format('Y-m-d'),
            'reason' => fake()->sentence(),
            'status' => fake()->randomElement(['pending', 'approved', 'rejected']),
            'approved_by' => null,
        ];
    }
}
