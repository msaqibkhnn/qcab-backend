// cPanel "Setup Node.js App" startup file (Phusion Passenger).
// Set "Application startup file" to: app.js
// The compiled NestJS app (dist/main.js) starts itself on require().
require('dotenv').config();
require('./dist/main');
