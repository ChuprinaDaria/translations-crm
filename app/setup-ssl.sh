#!/bin/bash
# Скрипт для налаштування Let's Encrypt SSL сертифікату

echo "Для налаштування SSL потрібно:"
echo "1. Мати домен який вказує на IP сервера (157.180.36.97)"
echo "2. Встановити certbot"
echo ""
echo "Команди для встановлення:"
echo "sudo apt-get update"
echo "sudo apt-get install -y certbot"
echo "sudo certbot certonly --standalone -d api.dzyga-catering.com.ua"
echo ""
echo "Після отримання сертифікату оновіть nginx.conf щоб використовувати:"
echo "ssl_certificate /etc/letsencrypt/live/api.dzyga-catering.com.ua/fullchain.pem;"
echo "ssl_certificate_key /etc/letsencrypt/live/api.dzyga-catering.com.ua/privkey.pem;"

