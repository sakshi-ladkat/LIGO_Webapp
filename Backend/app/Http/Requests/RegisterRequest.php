<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'token' => 'required|string',
            'email' => 'required|email|max:255',
            'institute_id' => 'required|exists:institutes,id',
            'first_name' => 'required|string|max:255',
            'middle_name' => 'nullable|string|max:255',
            'last_name' => 'required|string|max:255',
            'prefix' => 'nullable|string|max:50',
            'address_line1' => 'required|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            'address_line3' => 'nullable|string|max:255',
            'city' => 'required|string|max:255',
            'state' => 'required|string|max:255',
            'postal_code' => 'required|string|max:20',
            'continent' => 'required|string|max:255',
            'country' => 'required|string|max:255',
            'office_country_code' => 'required|string|max:10',
            'office_city_code' => 'nullable|string|max:10',
            'office_number' => 'required|string|max:20',
            'fax_number' => 'nullable|string|max:20',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'token.required' => 'Verification token is required',
            'email.required' => 'Email is required',
            'email.email' => 'Please provide a valid email address',
            'institute_id.required' => 'Please select an institute',
            'institute_id.exists' => 'Selected institute is invalid',
            'first_name.required' => 'First name is required',
            'last_name.required' => 'Last name is required',
            'address_line1.required' => 'Address is required',
            'city.required' => 'City is required',
            'state.required' => 'State is required',
            'postal_code.required' => 'Postal code is required',
            'continent.required' => 'Please select a continent',
            'country.required' => 'Please select a country',
            'office_country_code.required' => 'Country code is required',
            'office_number.required' => 'Office number is required',
        ];
    }
}
