<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use App\Models\Category;

class CategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // =========================
        // 1. PARENT CATEGORIES
        // =========================
        $student = Category::updateOrCreate(
            ['slug' => Str::slug('Student')],
            [
            'name' => 'Student',
            'description' => 'All student related categories',
            'is_active' => true,
        ]);

        $faculty = Category::updateOrCreate(
            ['slug' => Str::slug('Faculty')],
            [
            'name' => 'Faculty',
            'description' => 'Teaching faculty categories',
            'is_active' => true,
        ]);

        $researcher = Category::updateOrCreate(
            ['slug' => Str::slug('Researcher / Scientist')],
            [
            'name' => 'Researcher / Scientist',
            'description' => 'Research related categories',
            'is_active' => true,
        ]);

        $staff = Category::updateOrCreate(
            ['slug' => Str::slug('Staff')],
            [
            'name' => 'Staff',
            'description' => 'All staff related categories',
            'is_active' => true,
        ]);

        // =========================
        // 2. STUDENT SUBCATEGORIES
        // =========================
        $studentSubs = [
            'Undergraduate Student (UG Student)',
            'Postgraduate Student (PG Student / Master Student)',
            'PhD Student',
            'Research Student',
            'Project Student',
            'Visiting Student',
            'Exchange Student',
            'Internship Student',
            'Summer Intern',
            'Research Fellow Student',
        ];

        foreach ($studentSubs as $name) {
            Category::updateOrCreate(
                ['slug' => Str::slug($name)],
                [
                'parent_id' => $student->id,
                'name' => $name,
                'is_active' => true,
            ]);
        }

        // =========================
        // 3. FACULTY SUBCATEGORIES
        // =========================
        $facultySubs = [
            'Professor',
            'Associate Professor',
            'Assistant Professor',
            'Adjunct Professor',
            'Visiting Professor',
            'Emeritus Professor',
            'Research Professor',
            'Teaching Professor',
            'Lecturer',
            'Senior Lecturer',
            'Visiting Faculty',
        ];

        foreach ($facultySubs as $name) {
            Category::updateOrCreate(
                ['slug' => Str::slug($name)],
                [
                'parent_id' => $faculty->id,
                'name' => $name,
                'is_active' => true,
            ]);
        }

        // =========================
        // 4. RESEARCHER SUBCATEGORIES
        // =========================
        $researcherSubs = [
            'Postdoctoral Researcher (Postdoc)',
            'Research Fellow',
            'Senior Research Fellow',
            'Junior Research Fellow',
            'Research Associate',
            'Research Scientist',
            'Principal Scientist',
            'Project Scientist',
            'Visiting Researcher',
            'Research Assistant',
            'Visiting Scientist',
            'Visiting Scholar',
            'Guest Researcher',
            'External Collaborator',
        ];

        foreach ($researcherSubs as $name) {
            Category::updateOrCreate(
                ['slug' => Str::slug($name)],
                [
                'parent_id' => $researcher->id,
                'name' => $name,
                'is_active' => true,
            ]);
        }

        // =========================
        // 5. STAFF SUBCATEGORIES
        // =========================
        $staffSubs = [
            'Administrative Staff',
            'Scientific Officer',
            'Scientific Assistant',
        ];

        foreach ($staffSubs as $name) {
            Category::updateOrCreate(
                ['slug' => Str::slug($name)],
                [
                'parent_id' => $staff->id,
                'name' => $name,
                'is_active' => true,
            ]);
        }
    }
}