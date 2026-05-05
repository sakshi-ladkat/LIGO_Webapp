FROM php:8.3-cli AS backend

RUN apt-get update && apt-get install -y \
    git \
    curl \
    unzip \
    libsqlite3-dev \
    sqlite3 \
    && docker-php-ext-install pdo pdo_sqlite pdo_mysql \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/backend

COPY composer.json composer.lock ./

RUN composer install --no-dev --no-scripts --no-interaction --prefer-dist --optimize-autoloader --ignore-platform-reqs

COPY . .

RUN cp .env.example .env \
    && php artisan key:generate --force

# ✅ ONLY create DB file (no migrate here)
RUN mkdir -p database \
    && touch database/database.sqlite

RUN chmod -R 775 storage bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 8000

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]