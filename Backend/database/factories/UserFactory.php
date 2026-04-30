<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'email' => fake()->unique()->safeEmail(),
            'status' => 'filled',
            'remember_token' => Str::random(10),
        ];
    }

    /**
     * Configure the model factory.
     */
    public function configure(): static
    {
        return $this->afterCreating(function (User $user) {
            // Assign default role (e.g. basic_admin or supervisor)
            $roleId = \Illuminate\Support\Facades\DB::table('roles')->where('slug', 'supervisor')->value('id') 
                      ?? \Illuminate\Support\Facades\DB::table('roles')->first()?->id;
            
            if ($roleId) {
                \Illuminate\Support\Facades\DB::table('user_roles')->updateOrInsert(
                    ['user_id' => $user->user_id, 'role_id' => $roleId],
                    ['is_active' => true, 'created_at' => now(), 'updated_at' => now()]
                );
            }

            // Assign default institute and category
            $instId = \Illuminate\Support\Facades\DB::table('institutes')->first()?->id;
            $catId = \Illuminate\Support\Facades\DB::table('categories')->first()?->id;

            if ($instId && $catId) {
                \Illuminate\Support\Facades\DB::table('user_affilation')->updateOrInsert(
                    ['user_id' => $user->user_id],
                    [
                        'institute_id' => $instId,
                        'category_id' => $catId,
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]
                );
            }
        });
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}
