🌍 WorldTripLink WhatsApp Automation Backend
This is a Node.js backend for a WhatsApp-based cab booking and travel assistant service. It integrates with the WhatsApp Business Cloud API and Google Maps APIs to provide a seamless, interactive cab booking experience via WhatsApp.

🚀 Features
📱 WhatsApp Chatbot for cab booking using interactive messages

📍 Smart Location Suggestions with Google Places Autocomplete

🗺️ Popular & Recent Locations like airports, malls, IT parks, etc.

📡 Live GPS Location Sharing for precise pickup/drop

💸 Fare Estimation based on distance, trip type, and vehicle

🚗 Multiple Vehicle Options: Sedan, SUV, Tempo Traveller

🧾 Booking Summary & Confirmation with final pricing

📬 Admin Notifications via WhatsApp

🧠 In-Memory Booking State for fast prototyping (use DB in prod)

🌐 Support Links & Website Access

🇮🇳 Indian Number Support (including Marathi numerals)

📡 WhatsApp Webhook Endpoints
Endpoint	Description
GET /webhook	Webhook verification for WhatsApp API
POST /webhook	Main handler for incoming WhatsApp messages

🧾 API Endpoints
Endpoint	Purpose
GET /api/vehicles	Get available vehicle types and pricing
POST /api/calculate-fare	Calculate fare based on trip parameters
POST /api/booking	Create a new booking
GET /api/booking/:bookingId	Fetch booking details by ID
GET /api/places/autocomplete	Autocomplete location using Google Places
GET /api/test-google	Test Google API integration

🧠 How It Works
User sends a message like "hi" or "trip"

Bot guides them to select:

Pickup location (autocomplete or GPS)

Drop location

Trip type: One-way / Roundtrip / Rental

Vehicle type: Sedan / SUV / Tempo

Fare is calculated using Google Distance API

User enters their phone number (supports Marathi digits)

Booking summary is shown and confirmed

Booking details are sent to user and admin via WhatsApp

🛠️ Technologies Used
Node.js, Express.js

WhatsApp Business Cloud API

Google Maps (Places & Distance Matrix API)

Axios for HTTP requests

Ngrok for local development

In-memory state (for demo; use DB in production)

