#!/bin/bash

# Step 1: Install necessary packages
echo "Installing necessary packages..."
sudo apt update -y
sudo apt upgrade -y
sudo apt install -y nginx unzip git curl certbot python3-certbot-nginx openssl libssl-dev tcl tcl-dev
# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install docker-compose-plugin


# Step 2: Start and enable Docker service
echo "Starting Docker service..."
sudo systemctl start docker
sudo systemctl enable docker

# Step 3: Configure Firewall
echo "Setting up firewall..."
sudo apt install -y ufw
sudo ufw allow OpenSSH

# Open necessary ports
# Remove outside access for these three
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

sudo ufw enable

# Step 4: Configure SELinux (not applicable in Ubuntu)
echo "SELinux is not applicable on Ubuntu. Skipping..."

# Step 5: Configure NGINX
echo "Installing and configuring Nginx..."
sudo mkdir -p /etc/nginx/sites-available
sudo mkdir -p /etc/nginx/sites-enabled

# Create a sample Nginx site config
cat <<EOF | sudo tee /etc/nginx/sites-available/vn-game.gmetarave.com
# Upstream block for Bun servers
upstream bun-app {
    server 127.0.0.1:8081;
    server 127.0.0.1:8082;
}

# HTTP server block, redirect to HTTPS
server {
    listen 80;
    server_name vn-game.gmetarave.com;

    if ($host = vn-game.gmetarave.com) {
        return 301 https://$host$request_uri;
    }

    return 404; # Default fallback if the above condition fails
}

# HTTPS server block
server {
    listen 443 ssl;
    server_name vn-game.gmetarave.com;

    ssl_certificate /etc/letsencrypt/live/vn-game.gmetarave.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/vn-game.gmetarave.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

    # Location for all other traffic, proxy to the Bun app upstream
    location / {
        proxy_pass http://bun-app;  # Use the upstream block for load balancing
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF


# Enable the site
sudo ln -s /etc/nginx/sites-available/vn-game.gmetarave.com /etc/nginx/sites-enabled/

# Include the sites-enabled directory in nginx.conf if not already included
if ! grep -q "include /etc/nginx/sites-enabled/\*;" /etc/nginx/nginx.conf; then
    sudo sed -i '/http {/a\    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf
fi

# Reload NGINX
sudo systemctl reload nginx

# Step 6: Install Certbot and SSL Certificate
echo "Requesting SSL certificate for vn-game.gmetarave.com..."
sudo certbot --nginx -d vn-game.gmetarave.com --non-interactive --agree-tos -m paulanthonyarriola@gmail.com
sudo certbot renew --dry-run

# Step 18: Run the Engine container


#step 20: Install Bun
curl -fsSL https://bun.sh/install | bash
source /root/.bashrc 


#Step 21: Clone Server
git clone https://github.com/YirenNing24/gmr-beats-server-bun-ts.git
cd gmr-beats-server-bun-ts


#Step 22: Install NPM 
sudo apt install -y nodejs
sudo apt install -y npm


DOTENV_ME="me_96805217555cc107b6f0e8d879d92f100bc5eada373ed74877bd432db3e9ec0a"


echo "Creating .env.me file with DOTENV_ME variable..."
echo $DOTENV_ME > .env.me
chmod 600 .env.me # Restrict file access to owner only

#Step 25: Run bun server
npx dotenv-vault pull -y
bun install -y