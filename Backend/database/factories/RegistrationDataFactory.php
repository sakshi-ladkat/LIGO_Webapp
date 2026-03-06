<?php

namespace Database\Factories;

use App\Models\RegistrationData;
use App\Models\Institute;
use Illuminate\Database\Eloquent\Factories\Factory;

class RegistrationDataFactory extends Factory
{
    protected $model = RegistrationData::class;

    public function definition(): array
    {
        return [
            'email' => fake()->unique()->safeEmail(),
            'institute_id' => Institute::inRandomOrder()->first()?->id,
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'dob' => fake()->date('Y-m-d', '-20 years'),
            'gender' => fake()->randomElement(['male', 'female', 'prefer_not_to_say']),
            'prefix' => fake()->randomElement(['Mr.', 'Ms.', 'Dr.']),
            'address_line1' => fake()->streetAddress(),
            'city' => fake()->city(),
            'state' => fake()->state(),
            'postal_code' => fake()->postcode(),
            'continent' => fake()->randomElement(['1', '2', '3', '4']), // IDs assuming ContinentSeeder ran
            'country' => fake()->randomElement(['1', '2', '3', '4', '5']), // IDs assuming CountrySeeder ran
            'office_country_code' => '+1',
            'office_number' => fake()->numerify('##########'),
            'status' => 'completed',
            'email_verified_at' => now(),
            'password_set_at' => now(),
        ];
    }
}
