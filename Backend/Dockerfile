FROM php:8.2-cli

RUN apt-get update -y && apt-get install -y \
    libmcrypt-dev \
    unzip \
    libpq-dev \
    zip \
    default-mysql-client \
    git \
    && docker-php-ext-install pdo pdo_mysql sockets

# Install Composer
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

WORKDIR /app
COPY . .

# Install dependencies (ignoring scripts during build so docker-compose volume doesn't override it improperly)
RUN composer install --no-interaction --no-scripts

EXPOSE 8000

# Start Laravel development server
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
