const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public')); // Serve static files

// Configuration
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || '65yhghg767576567ytghvbhjkhgviouyg9087ytfdyu90-uyt';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || 'EAAR2GJOCfXsBO60OyMygwV7ZC96gLnasIiVLMnrZAE1EJhnMv1SmEi7vbM4Kp8RtKIIu4B58QdZBx6l1RocTYonP6bH8KqiqGLb75cNbPB6svSoe3pkWKhFcEyZCvDTZCdllv1anakQ21x57XOQiNaWRrwqMb5ulcOhbOGSfoAt5nnqAal9unjJrAXKE9m1eWGU1jhZAeK0VqOTVt9ZAqeB7ZAcbvDIuo6P8D4qlk1Dw';
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '693139793877647';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyCelDo4I5cPQ72TfCTQW-arhPZ7ALNcp8w';
const CONTACT_FORWARD_NUMBER = process.env.CONTACT_FORWARD_NUMBER || '919130030054';

// In-memory storage (use database in production)
let userStates = {};
let bookings = {};
let userLocationHistory = {}; // Store user's location history
let popularRoutes = {}; // Cache popular routes

const vehicles = {
  sedan: {
    name: 'Sedan',
    price: 12,
    capacity: '4 Passengers',
    description: 'Comfortable sedan for city travel'
  },
  suv: {
    name: 'SUV',
    price: 16,
    capacity: '6-7 Passengers',
    description: 'Spacious SUV for family trips'
  },
  tempo: {
    name: 'Tempo Traveller',
    price: 22,
    capacity: '12-14 Passengers',
    description: 'Large vehicle for group travel'
  }
};

// Enhanced location categories
const locationCategories = {
  airports: [
    { name: 'Pune Airport', address: 'Lohegaon Airport, Pune', type: 'airport', coordinates: { lat: 18.5822, lng: 73.9197 } },
    { name: 'Mumbai Airport Domestic', address: 'Chhatrapati Shivaji Airport T1, Mumbai', type: 'airport', coordinates: { lat: 19.0896, lng: 72.8656 } },
    { name: 'Mumbai Airport International', address: 'Chhatrapati Shivaji Airport T2, Mumbai', type: 'airport', coordinates: { lat: 19.0988, lng: 72.8681 } },
    { name: 'Delhi Airport', address: 'Indira Gandhi International Airport, Delhi', type: 'airport', coordinates: { lat: 28.5562, lng: 77.1000 } },
    { name: 'Bangalore Airport', address: 'Kempegowda International Airport, Bangalore', type: 'airport', coordinates: { lat: 13.1986, lng: 77.7066 } }
  ],
  stations: [
    { name: 'Pune Railway Station', address: 'Pune Junction, Pune', type: 'station', coordinates: { lat: 18.5314, lng: 73.8747 } },
    { name: 'Mumbai Central', address: 'Mumbai Central Railway Station, Mumbai', type: 'station', coordinates: { lat: 18.9708, lng: 72.8205 } },
    { name: 'Hadapsar Station', address: 'Hadapsar Railway Station, Pune', type: 'station', coordinates: { lat: 18.5089, lng: 73.9260 } },
    { name: 'Dadar Station', address: 'Dadar Railway Station, Mumbai', type: 'station', coordinates: { lat: 19.0187, lng: 72.8428 } },
    { name: 'New Delhi Station', address: 'New Delhi Railway Station, Delhi', type: 'station', coordinates: { lat: 28.6430, lng: 77.2197 } }
  ],
  malls: [
    { name: 'Phoenix Marketcity', address: 'Viman Nagar, Pune', type: 'mall', coordinates: { lat: 18.5679, lng: 73.9143 } },
    { name: 'Seasons Mall', address: 'Hadapsar, Pune', type: 'mall', coordinates: { lat: 18.5089, lng: 73.9260 } },
    { name: 'Amanora Mall', address: 'Hadapsar, Pune', type: 'mall', coordinates: { lat: 18.5204, lng: 73.9370 } },
    { name: 'Westside Phoenix', address: 'Wakad, Pune', type: 'mall', coordinates: { lat: 18.5958, lng: 73.7721 } },
    { name: 'Palladium Mall', address: 'Lower Parel, Mumbai', type: 'mall', coordinates: { lat: 19.0010, lng: 72.8306 } }
  ],
  itParks: [
    { name: 'Hinjewadi IT Park Phase 1', address: 'Hinjewadi Phase 1, Pune', type: 'office', coordinates: { lat: 18.5908, lng: 73.7369 } },
    { name: 'Hinjewadi IT Park Phase 2', address: 'Hinjewadi Phase 2, Pune', type: 'office', coordinates: { lat: 18.5679, lng: 73.7143 } },
    { name: 'Magarpatta City', address: 'Hadapsar, Pune', type: 'office', coordinates: { lat: 18.5204, lng: 73.9370 } },
    { name: 'EON IT Park', address: 'Kharadi, Pune', type: 'office', coordinates: { lat: 18.5515, lng: 73.9524 } },
    { name: 'Cyber City Gurgaon', address: 'DLF Cyber City, Gurgaon', type: 'office', coordinates: { lat: 28.4939, lng: 77.0830 } }
  ],
  hotels: [
    { name: 'JW Marriott Pune', address: 'Senapati Bapat Road, Pune', type: 'hotel', coordinates: { lat: 18.5314, lng: 73.8314 } },
    { name: 'The Westin Pune', address: 'Koregaon Park, Pune', type: 'hotel', coordinates: { lat: 18.5362, lng: 73.8840 } },
    { name: 'Conrad Pune', address: 'Mangaldas Road, Pune', type: 'hotel', coordinates: { lat: 18.5196, lng: 73.8553 } },
    { name: 'Taj Mumbai', address: 'Apollo Bunder, Mumbai', type: 'hotel', coordinates: { lat: 18.9220, lng: 72.8332 } }
  ]
};

// Popular routes database (can be populated from analytics)
const popularRoutesDB = {
  'pune airport': [
    { name: 'Hinjewadi IT Park', duration: '45 min', estimatedFare: 800, emoji: '🏢', category: 'IT Parks', address: 'Hinjewadi Phase 1, Pune' },
    { name: 'Mumbai Airport', duration: '3.5 hrs', estimatedFare: 4200, emoji: '✈️', category: 'Airports', address: 'Chhatrapati Shivaji Airport, Mumbai' },
    { name: 'Pune Station', duration: '40 min', estimatedFare: 600, emoji: '🚆', category: 'Stations', address: 'Pune Railway Station' },
    { name: 'Magarpatta City', duration: '25 min', estimatedFare: 450, emoji: '🏢', category: 'IT Parks', address: 'Magarpatta City, Hadapsar' },
    { name: 'Baner', duration: '35 min', estimatedFare: 500, emoji: '🏠', category: 'Residential', address: 'Baner, Pune' }
  ],
  'mumbai airport': [
    { name: 'Pune Airport', duration: '3.5 hrs', estimatedFare: 4200, emoji: '✈️', category: 'Airports', address: 'Pune Airport, Lohegaon' },
    { name: 'Mumbai Central', duration: '45 min', estimatedFare: 800, emoji: '🚆', category: 'Stations', address: 'Mumbai Central Station' },
    { name: 'Thane Station', duration: '30 min', estimatedFare: 600, emoji: '🚆', category: 'Stations', address: 'Thane Railway Station' },
    { name: 'Bandra Kurla Complex', duration: '25 min', estimatedFare: 500, emoji: '🏢', category: 'Business', address: 'BKC, Mumbai' }
  ],
  'pune station': [
    { name: 'Pune Airport', duration: '40 min', estimatedFare: 600, emoji: '✈️', category: 'Airports', address: 'Pune Airport, Lohegaon' },
    { name: 'Hinjewadi IT Park', duration: '50 min', estimatedFare: 700, emoji: '🏢', category: 'IT Parks', address: 'Hinjewadi Phase 1' },
    { name: 'Koregaon Park', duration: '15 min', estimatedFare: 200, emoji: '🏨', category: 'Hotels', address: 'Koregaon Park Area' },
    { name: 'Baner', duration: '45 min', estimatedFare: 600, emoji: '🏠', category: 'Residential', address: 'Baner, Pune' }
  ],
  'hinjewadi': [
    { name: 'Pune Airport', duration: '45 min', estimatedFare: 800, emoji: '✈️', category: 'Airports', address: 'Pune Airport, Lohegaon' },
    { name: 'Pune Station', duration: '50 min', estimatedFare: 700, emoji: '🚆', category: 'Stations', address: 'Pune Railway Station' },
    { name: 'Mumbai Airport', duration: '4 hrs', estimatedFare: 4500, emoji: '✈️', category: 'Airports', address: 'Mumbai Airport' },
    { name: 'Baner', duration: '15 min', estimatedFare: 200, emoji: '🏠', category: 'Residential', address: 'Baner, Pune' }
  ]
};

// ==================== WEB API ROUTES ====================

// Get available vehicles
app.get('/api/vehicles', (req, res) => {
  res.json(vehicles);
});

// Calculate fare
app.post('/api/calculate-fare', async (req, res) => {
  try {
    const { pickup, drop, tripType, vehicle } = req.body;
    
    if (!pickup || !drop || !tripType || !vehicle) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const distance = await getDistance(pickup, drop);
    if (!distance) {
      return res.status(500).json({ error: 'Unable to calculate distance' });
    }

    let totalKm = parseFloat(distance);
    if (tripType === 'roundtrip') {
      totalKm *= 2;
    }

    const farePerKm = vehicles[vehicle].price;
    const totalFare = Math.round(totalKm * farePerKm);

    res.json({
      distance: distance,
      totalKm: totalKm,
      farePerKm: farePerKm,
      totalFare: totalFare,
      vehicleInfo: vehicles[vehicle]
    });
  } catch (error) {
    console.error('Fare calculation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create booking
app.post('/api/booking', async (req, res) => {
  try {
    const {
      pickup,
      drop,
      tripType,
      vehicle,
      pickupDate,
      pickupTime,
      email,
      mobile,
      passengerName
    } = req.body;

    // Validation
    if (!pickup || !drop || !tripType || !vehicle || !email || !mobile || !passengerName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Calculate fare
    const distance = await getDistance(pickup, drop);
    if (!distance) {
      return res.status(500).json({ error: 'Unable to calculate distance' });
    }

    let totalKm = parseFloat(distance);
    if (tripType === 'roundtrip') {
      totalKm *= 2;
    }

    const farePerKm = vehicles[vehicle].price;
    const totalFare = Math.round(totalKm * farePerKm);

    // Generate booking ID
    const bookingId = 'WTL' + Date.now().toString().slice(-6);

    // Create booking object
    const booking = {
      bookingId,
      passengerName,
      email,
      mobile,
      pickup,
      drop,
      tripType,
      vehicle: vehicles[vehicle].name,
      distance,
      totalKm,
      farePerKm,
      totalFare,
      pickupDate,
      pickupTime,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    // Store booking
    bookings[bookingId] = booking;

    // Send notification to business WhatsApp
    await sendBookingNotificationToWhatsApp(booking);

    res.json({
      success: true,
      bookingId,
      booking
    });

  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get booking details
app.get('/api/booking/:bookingId', (req, res) => {
  const { bookingId } = req.params;
  const booking = bookings[bookingId];
  
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  
  res.json(booking);
});

// Google Places Autocomplete
app.get('/api/places/autocomplete', async (req, res) => {
  try {
    const { input } = req.query;
    if (!input) {
      return res.status(400).json({ error: 'Input required' });
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_API_KEY}&components=country:in`;
    const response = await axios.get(url);
    
    res.json(response.data);
  } catch (error) {
    console.error('Places API error:', error);
    res.status(500).json({ error: 'Places API error' });
  }
});

// Test Google API endpoint
app.get('/api/test-google', async (req, res) => {
  try {
    // Test Places API
    const placesUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=pune&key=${GOOGLE_API_KEY}&components=country:in`;
    const placesResponse = await axios.get(placesUrl);
    
    // Test Distance Matrix API
    const distanceUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=Pune&destinations=Mumbai&key=${GOOGLE_API_KEY}`;
    const distanceResponse = await axios.get(distanceUrl);
    
    res.json({
      places_api: {
        status: placesResponse.data.status,
        predictions_count: placesResponse.data.predictions?.length || 0
      },
      distance_api: {
        status: distanceResponse.data.status,
        distance: distanceResponse.data.rows[0]?.elements[0]?.distance?.text
      }
    });
  } catch (error) {
    console.error('Google API test error:', error);
    res.status(500).json({ error: 'Google API test failed' });
  }
});

// ==================== WHATSAPP WEBHOOK ====================

// Webhook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified successfully!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Handle incoming WhatsApp messages
app.post('/webhook', async (req, res) => {
  try {
    console.log('📨 Webhook received:', JSON.stringify(req.body, null, 2));
    
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (messages && messages.length > 0) {
      const msg = messages[0];
      const from = msg.from;
      const messageBody = msg.text?.body?.toLowerCase() || '';
      
      console.log(`💬 Message from ${from}: "${messageBody}"`);
      console.log(`🔧 Message type: ${msg.type}`);
      
      // Initialize user state
      userStates[from] = userStates[from] || {};
      console.log(`👤 User ${from} current stage: ${userStates[from].stage || 'new'}`);

      await handleWhatsAppMessage(from, messageBody, msg);
    } else {
      console.log('📭 No messages in webhook payload');
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.sendStatus(500);
  }
});

// ==================== ENHANCED MESSAGE HANDLER ====================

async function handleWhatsAppMessage(from, text, msg) {
  const state = userStates[from];

  // Handle initial greeting
  if (text.includes('hi') || text.includes('hello') || text.includes('start')) {
    userStates[from] = { stage: 'welcome' };
    return sendWhatsAppWelcomeMessage(from);
  }

  // Handle trip booking initiation
  if (text.includes('trip') || text.includes('travel') || text.includes('book')) {
    userStates[from] = { stage: 'tripType' };
    return sendTripTypeButtons(from);
  }

  // Handle GPS location messages
  if (msg.location) {
    return handleGPSLocation(from, msg.location);
  }

  // Handle interactive button responses
  if (msg.interactive?.button_reply?.id) {
    const buttonId = msg.interactive.button_reply.id;
    return handleEnhancedButtonResponse(from, buttonId);
  }

  // Handle list responses (for location and vehicle selection)
  if (msg.interactive?.list_reply?.id) {
    const listId = msg.interactive.list_reply.id;
    return handleEnhancedListResponse(from, listId);
  }

  // Handle text responses based on current stage
  switch (state.stage) {
    case 'pickup_search':
      // User typed a location, show autocomplete suggestions
      if (text.length < 2) {
        return sendMessage(from, '📍 Please type at least 2 characters for location search.');
      }
      await sendMessage(from, '🔍 Searching locations...');
      const pickupSuggestions = await getLocationSuggestions(text);
      state.pickupSearchText = text;
      if (pickupSuggestions && pickupSuggestions.length > 0) {
        return sendLocationSuggestions(from, pickupSuggestions, 'pickup', `📍 Found locations for "${text}":`);
      } else {
        return sendLocationSuggestions(from, [], 'pickup', `📍 No results for "${text}".`);
      }

    case 'drop_search':
      // User typed a location, show autocomplete suggestions
      if (text.length < 2) {
        return sendMessage(from, '📍 Please type at least 2 characters for location search.');
      }
      await sendMessage(from, '🔍 Searching destinations...');
      const dropSuggestions = await getLocationSuggestions(text);
      state.dropSearchText = text;
      if (dropSuggestions && dropSuggestions.length > 0) {
        return sendLocationSuggestions(from, dropSuggestions, 'drop', `📍 Found destinations for "${text}":`);
      } else {
        return sendLocationSuggestions(from, [], 'drop', `📍 No results for "${text}".`);
      }

    case 'mobile':
      // Accept only valid Indian mobile numbers, allow Marathi numerals
      const marathiToEnglishDigits = (input) => input.replace(/[\u0966-\u096F]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0966 + 48));
      let cleanMobile = text.replace(/\D/g, '');
      if (/^[\u0966-\u096F]+$/.test(text)) {
        cleanMobile = marathiToEnglishDigits(text);
      }
      if (!isValidMobile(cleanMobile)) {
        return sendMessage(from, '❌ *अवैध मोबाइल नंबर*\n\nकृपया वैध भारतीय मोबाइल नंबर टाका:\n\n✅ *योग्य स्वरूप:*\n• ९८७६५४३२१०\n• 9876543210\n\n❌ *६, ७, ८, किंवा ९ ने सुरू होणारा १० अंकी नंबर टाका*');
      }
      // Store cleaned mobile number
      state.mobile = cleanMobile.length === 11 ? cleanMobile.substring(2) : cleanMobile;
      // Skip email, go to summary
      return showBookingSummary(from);

    case 'email':
      // Email is no longer required, skip to summary
      return showBookingSummary(from);

    case 'confirm':
      if (text === 'yes' || text === 'confirm') {
        return createWhatsAppBooking(from);
      } else if (text === 'no' || text === 'cancel') {
        delete userStates[from];
        return sendMessage(from, '❌ Booking cancelled. Type "trip" to start a new booking.');
      }
      return sendMessage(from, 'Please reply with "yes" to confirm or "no" to cancel.');

    default:
      return sendMessage(from, '🚗 *Welcome to WorldTripLink!*\n\nTo start booking, type:\n• "trip" - Book a ride\n• "hi" - Get welcome menu\n\n🌐 Or visit: https://worldtriplink.com/');
  }
}

// ==================== ENHANCED WHATSAPP UI FUNCTIONS ====================

async function sendWhatsAppWelcomeMessage(to) {
  const message = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: '🚗 *Welcome to WorldTripLink!* 😊\n\nWe\'re excited to assist you with your travel needs. Choose an option below:'
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: 'book_trip',
              title: '🚗 Book a Trip'
            }
          },
          {
            type: 'reply',
            reply: {
              id: 'support',
              title: '💬 Support'
            }
          },
          {
            type: 'reply',
            reply: {
              id: 'website',
              title: '🌐 Visit Website'
            }
          }
        ]
      }
    }
  };

  return sendInteractiveMessage(to, message);
}

async function sendTripTypeButtons(to) {
  const message = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: '🛣️ *TRIP TYPE*\n\nPlease choose your trip type:'
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: 'oneway',
              title: '➡️ One Way'
            }
          },
          {
            type: 'reply',
            reply: {
              id: 'roundtrip',
              title: '🔄 Round Trip'
            }
          },
          {
            type: 'reply',
            reply: {
              id: 'rental',
              title: '⏰ Rental'
            }
          }
        ]
      }
    }
  };

  return sendInteractiveMessage(to, message);
}

// ==================== ENHANCED PICKUP LOCATION FUNCTIONS ====================

async function sendEnhancedPickupOptions(to) {
  const userHistory = userLocationHistory[to] || { recent: [], frequent: [] };
  
  // Check if user has recent locations
  if (userHistory.recent && userHistory.recent.length > 0) {
    return sendPickupWithHistory(to, userHistory);
  } else {
    return sendPickupFirstTime(to);
  }
}

async function sendPickupFirstTime(to) {
  const message = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: '📍 *PICKUP LOCATION*\n\nHow would you like to set your pickup location?'
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: 'share_gps_pickup',
              title: '📍 Share GPS Location'
            }
          },
          {
            type: 'reply',
            reply: {
              id: 'categories_pickup',
              title: '🏢 Browse Categories'
            }
          },
          {
            type: 'reply',
            reply: {
              id: 'type_pickup',
              title: '⌨️ Type Location'
            }
          }
        ]
      }
    }
  };
  return sendInteractiveMessage(to, message);
}

async function sendPickupWithHistory(to, userHistory) {
  const recentLocations = userHistory.recent.slice(0, 3).map((loc, index) => ({
    id: `recent_pickup_${index}`,
    title: `📍 ${loc.name}`,
    description: `${truncateText(loc.address, 50)} • Used ${loc.count} times`
  }));

  const message = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: '📍 *PICKUP LOCATION*\n\n⭐ Your recent locations:'
      },
      action: {
        button: 'Choose Pickup',
        sections: [
          {
            title: 'Recent Locations',
            rows: recentLocations
          },
          {
            title: 'Other Options',
            rows: [
              {
                id: 'share_gps_pickup',
                title: '📍 Share GPS Location',
                description: 'Use current location'
              },
              {
                id: 'categories_pickup',
                title: '🏢 Browse Categories',
                description: 'Airports, Stations, Malls'
              },
              {
                id: 'type_pickup',
                title: '⌨️ Type New Location',
                description: 'Enter address manually'
              }
            ]
          }
        ]
      }
    }
  };
  return sendInteractiveMessage(to, message);
}

// ==================== GPS LOCATION HANDLING ====================

async function requestGPSLocation(to, type) {
  const instructions = type === 'pickup' ? 
    '📍 *SHARE PICKUP LOCATION*\n\n🔹 Tap the 📎 attachment icon\n🔹 Select "Location"\n🔹 Choose "Send Your Current Location"' :
    '📍 *SHARE DROP LOCATION*\n\n🔹 Tap the 📎 attachment icon\n🔹 Select "Location"\n🔹 Choose "Send Your Current Location"';

  const message = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: `${instructions}\n\nOr use the options below:`
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: `${type}_gps_help`,
              title: '❓ How to Share'
            }
          },
          {
            type: 'reply',
            reply: {
              id: `${type}_type_instead`,
              title: '⌨️ Type Instead'
            }
          },
          {
            type: 'reply',
            reply: {
              id: `${type}_back_options`,
              title: '⬅️ Back to Options'
            }
          }
        ]
      }
    }
  };
  return sendInteractiveMessage(to, message);
}

async function handleGPSLocation(from, locationData) {
  const state = userStates[from];
  
  if (!locationData || !locationData.latitude || !locationData.longitude) {
    return sendMessage(from, '❌ Invalid location data. Please try sharing your location again or type your address manually.');
  }

  // Show processing message
  await sendMessage(from, '📍 Processing your location... Please wait.');

  try {
    // Reverse geocode to get address
    const address = await reverseGeocode(locationData.latitude, locationData.longitude);
    
    if (!address) {
      return sendMessage(from, '❌ Could not determine address from your location. Please type your address manually.');
    }

    // Show confirmation with address
    const isPickup = state.stage === 'pickup_gps' || !state.stage;
    const locationType = isPickup ? 'pickup' : 'drop';
    
    const confirmationText = `📍 *LOCATION DETECTED*\n\n✅ **Address:**\n${address}\n\n📐 **Coordinates:**\nLat: ${locationData.latitude.toFixed(6)}\nLng: ${locationData.longitude.toFixed(6)}\n\nIs this your ${locationType} location?`;

    const message = {
      messaging_product: 'whatsapp',
      to: from,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: confirmationText
        },
        action: {
          buttons: [
            {
              type: 'reply',
              reply: {
                id: 'confirm_gps_location',
                title: '✅ Yes, Correct'
              }
            },
            {
              type: 'reply',
              reply: {
                id: 'edit_gps_location',
                title: '📝 Edit Address'
              }
            },
            {
              type: 'reply',
              reply: {
                id: 'retry_gps_location',
                title: '🔄 Try Again'
              }
            }
          ]
        }
      }
    };

    // Store the location data temporarily
    state.tempGPSLocation = {
      address: address,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      type: locationType
    };

    return sendInteractiveMessage(from, message);

  } catch (error) {
    console.error('GPS location processing error:', error);
    return sendMessage(from, '❌ Error processing location. Please try typing your address manually.');
  }
}

async function handleGPSLocationConfirmation(from) {
  const state = userStates[from];
  const gpsData = state.tempGPSLocation;
  
  if (!gpsData) {
    return sendMessage(from, '❌ Location data lost. Please share your location again.');
  }

  if (gpsData.type === 'pickup') {
    state.pickup = gpsData.address;
    
    // Add to user history
    addToUserHistory(from, gpsData.address, 'pickup');
    
    // Clear temp data
    delete state.tempGPSLocation;
    
    // Proceed to drop location with smart suggestions
    return sendSmartDropSuggestions(from, gpsData.address);
  } else {
    state.drop = gpsData.address;
    
    // Add to user history
    addToUserHistory(from, gpsData.address, 'drop');
    
    // Clear temp data
    delete state.tempGPSLocation;
    
    // Calculate distance and show vehicles
    await calculateDistanceAndShowVehicles(from);
  }
}

// ==================== LOCATION CATEGORIES ====================

async function sendLocationCategories(to, type) {
  const message = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: `🏢 *${type.toUpperCase()} CATEGORIES*\n\nChoose a category for quick access:`
      },
      action: {
        button: 'Select Category',
        sections: [
          {
            title: 'Transport Hubs',
            rows: [
              {
                id: `${type}_cat_airports`,
                title: '✈️ Airports',
                description: 'Pune, Mumbai, Delhi airports'
              },
              {
                id: `${type}_cat_stations`,
                title: '🚆 Railway Stations',
                description: 'Major railway stations'
              }
            ]
          },
          {
            title: 'Business & Shopping',
            rows: [
              {
                id: `${type}_cat_itparks`,
                title: '🏢 IT Parks & Offices',
                description: 'Hinjewadi, Magarpatta, EON'
              },
              {
                id: `${type}_cat_malls`,
                title: '🛒 Shopping Malls',
                description: 'Phoenix, Seasons, Amanora'
              },
              {
                id: `${type}_cat_hotels`,
                title: '🏨 Hotels',
                description: 'Major hotels & resorts'
              }
            ]
          },
          {
            title: 'Manual Entry',
            rows: [
              {
                id: `${type}_type_manual`,
                title: '⌨️ Type Location',
                description: 'Enter address manually'
              }
            ]
          }
        ]
      }
    }
  };
  return sendInteractiveMessage(to, message);
}

async function sendCategoryLocations(to, category, type) {
  const locations = locationCategories[category] || [];
  
  if (locations.length === 0) {
    return sendMessage(to, '❌ No locations found in this category. Please try another category.');
  }

  const rows = locations.map((loc, index) => ({
    id: `${type}_${category}_${index}`,
    title: getLocationEmoji(loc.type) + ' ' + loc.name,
    description: truncateText(loc.address, 72)
  }));

  const message = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: `${getCategoryEmoji(category)} *${category.toUpperCase()}*\n\nSelect your ${type} location:`
      },
      action: {
        button: 'Select Location',
        sections: [
          {
            title: category.charAt(0).toUpperCase() + category.slice(1),
            rows: rows
          }
        ]
      }
    }
  };
  return sendInteractiveMessage(to, message);
}

// ==================== SMART DROP SUGGESTIONS ====================

async function sendSmartDropSuggestions(to, pickup) {
  const state = userStates[to];
  
  // Get popular routes based on pickup
  const suggestions = getPopularRoutesFromPickup(pickup);
  
  if (suggestions.length === 0) {
    // Fallback to regular drop selection
    state.stage = 'drop_search';
    const dropMessage = `📍 *DROP LOCATION*\n\n✅ **Pickup:** ${pickup}\n\nType your destination or choose from options below:`;
    await sendMessage(to, dropMessage);
    return sendLocationSuggestions(to, [], 'drop', '📍 Choose from popular destinations:');
  }

  // Build sections with popular routes
  const sections = [];
  
  // Group suggestions by category
  const groupedSuggestions = groupSuggestionsByCategory(suggestions);
  
  Object.keys(groupedSuggestions).forEach(category => {
    const rows = groupedSuggestions[category].slice(0, 3).map((suggestion, index) => ({
      id: `smart_drop_${category.toLowerCase().replace(' ', '')}_${index}`,
      title: `${suggestion.emoji} ${suggestion.name}`,
      description: `${suggestion.duration} • ₹${suggestion.estimatedFare}`
    }));

    if (rows.length > 0) {
      sections.push({
        title: category,
        rows: rows
      });
    }
  });

  // Add manual entry option
  sections.push({
    title: 'Other Options',
    rows: [
      {
        id: 'drop_type_manual',
        title: '⌨️ Type Location',
        description: 'Enter any destination'
      },
      {
        id: 'drop_categories',
        title: '🏢 Browse Categories',
        description: 'Airports, Stations, Malls'
      },
      {
        id: 'share_gps_drop',
        title: '📍 Share GPS Location',
        description: 'Use GPS for destination'
      }
    ]
  });

  const message = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: `📍 *DROP LOCATION*\n\n✅ **Pickup:** ${truncateText(pickup, 40)}\n\n🔥 **Popular destinations from here:**`
      },
      action: {
        button: 'Select Destination',
        sections: sections
      }
    }
  };

  return sendInteractiveMessage(to, message);
}

// ==================== ENHANCED BUTTON RESPONSE HANDLER ====================

async function handleEnhancedButtonResponse(from, buttonId) {
  const state = userStates[from];

  switch (buttonId) {
    case 'book_trip':
      state.stage = 'tripType';
      return sendTripTypeButtons(from);

    case 'support':
      return sendMessage(from, '💬 *SUPPORT*\n\nFor assistance, please contact:\n📞 Call: +91 91300 30054\n📧 Email: support@worldtriplink.com\n\n⏰ Available 24/7');

    case 'website':
      return sendMessage(from, '🌐 *VISIT WEBSITE*\n\nFor advanced features and online booking:\n🔗 https://worldtriplink.com/\n\n💡 Features include:\n• Instant fare calculator\n• Schedule bookings\n• Payment options\n• Booking history');

    case 'oneway':
    case 'roundtrip':
    case 'rental':
      state.tripType = buttonId;
      return sendEnhancedPickupOptions(from);

    case 'share_gps_pickup':
      state.stage = 'pickup_gps';
      return requestGPSLocation(from, 'pickup');

    case 'categories_pickup':
      return sendLocationCategories(from, 'pickup');

    case 'type_pickup':
      state.stage = 'pickup_search';
      return sendMessage(from, '📍 *TYPE PICKUP LOCATION*\n\nType your pickup location:\n\n💡 *Examples:*\n• "seasons mall"\n• "pune airport"\n• "hinjewadi phase 1"');

    case 'share_gps_drop':
      state.stage = 'drop_gps';
      return requestGPSLocation(from, 'drop');

    case 'categories_drop':
      return sendLocationCategories(from, 'drop');

    case 'type_drop':
      state.stage = 'drop_search';
      return sendMessage(from, '📍 *TYPE DROP LOCATION*\n\nType your destination:\n\n💡 *Examples:*\n• "mumbai airport"\n• "delhi station"\n• "bangalore"');

    case 'drop_type_manual':
      state.stage = 'drop_search';
      return sendMessage(from, '📍 *TYPE DROP LOCATION*\n\nType your destination:\n\n💡 *Examples:* "mumbai airport", "delhi", "bangalore"');

    case 'drop_categories':
      return sendLocationCategories(from, 'drop');

    case 'confirm_gps_location':
      return handleGPSLocationConfirmation(from);

    case 'edit_gps_location':
      const gpsData = state.tempGPSLocation;
      if (gpsData) {
        state.stage = gpsData.type === 'pickup' ? 'pickup_search' : 'drop_search';
        delete state.tempGPSLocation;
        return sendMessage(from, `📝 *EDIT ${gpsData.type.toUpperCase()} LOCATION*\n\nType your ${gpsData.type} location manually:`);
      }
      return sendMessage(from, '❌ No location to edit. Please start again.');

    case 'retry_gps_location':
      const retryData = state.tempGPSLocation;
      if (retryData) {
        return requestGPSLocation(from, retryData.type);
      }
      return sendMessage(from, '❌ Please start location sharing again.');

    case 'pickup_gps_help':
    case 'drop_gps_help':
      return sendMessage(from, '📱 *HOW TO SHARE LOCATION*\n\n1️⃣ Tap the 📎 attachment icon (bottom left)\n2️⃣ Select "Location" from menu\n3️⃣ Choose "Send Your Current Location"\n4️⃣ Wait for GPS to detect location\n5️⃣ Tap "Send"\n\n💡 *Tip:* Make sure location services are enabled!');

    case 'pickup_type_instead':
      state.stage = 'pickup_search';
      return sendMessage(from, '⌨️ *TYPE PICKUP LOCATION*\n\nType your pickup location manually:');

    case 'drop_type_instead':
      state.stage = 'drop_search';
      return sendMessage(from, '⌨️ *TYPE DROP LOCATION*\n\nType your destination manually:');

    case 'pickup_back_options':
      return sendEnhancedPickupOptions(from);

    case 'drop_back_options':
      return sendSmartDropSuggestions(from, state.pickup);

    case 'confirm_booking':
      return createWhatsAppBooking(from);

    case 'cancel_booking':
      delete userStates[from];
      return sendMessage(from, '❌ Booking cancelled. Type "trip" to start a new booking.');

    default:
      return sendMessage(from, '❌ Invalid option. Please try again or type "trip" to restart.');
  }
}

// ==================== ENHANCED LIST RESPONSE HANDLER ====================

async function handleEnhancedListResponse(from, listId) {
  const state = userStates[from];

  // Handle recent locations
  if (listId.startsWith('recent_pickup_')) {
    const index = parseInt(listId.split('_')[2]);
    const userHistory = userLocationHistory[from];
    if (userHistory && userHistory.recent[index]) {
      const location = userHistory.recent[index];
      state.pickup = location.address;
      
      // Update usage count
      location.count = (location.count || 0) + 1;
      location.lastUsed = new Date().toISOString();
      saveUserLocationHistory(from, userHistory);
      
      // Proceed to drop location with smart suggestions
      return sendSmartDropSuggestions(from, location.address);
    }
  }

  // Handle category selections
  if (listId.includes('_cat_')) {
    const parts = listId.split('_');
    const type = parts[0]; // pickup or drop
    const category = parts[2]; // airports, stations, etc.
    return sendCategoryLocations(from, category, type);
  }

  // Handle category location selections
  if (listId.includes('_airports_') || listId.includes('_stations_') || 
      listId.includes('_malls_') || listId.includes('_itparks_') || listId.includes('_hotels_')) {
    return handleCategoryLocationSelection(from, listId);
  }

  // Handle smart drop suggestions
  if (listId.startsWith('smart_drop_')) {
    return handleSmartDropSelection(from, listId);
  }

  // Handle manual type options
  if (listId.includes('_type_manual')) {
    const type = listId.split('_')[0];
    state.stage = type + '_search';
    return sendMessage(from, `⌨️ *TYPE ${type.toUpperCase()} LOCATION*\n\nType your ${type} location manually:`);
  }

  // Handle retry options
  if (listId === 'pickup_retry') {
    state.stage = 'pickup_search';
    return sendMessage(from, '📍 Type a different pickup location (try: "airport", "station", "city name"):');
  }
  
  if (listId === 'drop_retry') {
    state.stage = 'drop_search';
    return sendMessage(from, '📍 Type a different drop location (try: "airport", "station", "city name"):');
  }
  
  // Handle popular pickup locations
  if (listId.startsWith('pickup_popular_')) {
    const index = parseInt(listId.split('_')[2]);
    const popularLocations = getPopularLocations('pickup');
    if (popularLocations[index]) {
      state.pickup = popularLocations[index].description;
      
      // Add to user history
      addToUserHistory(from, popularLocations[index].description, 'pickup');
      
      return sendSmartDropSuggestions(from, popularLocations[index].description);
    }
  }
  
  // Handle popular drop locations
  else if (listId.startsWith('drop_popular_')) {
    const index = parseInt(listId.split('_')[2]);
    const popularLocations = getPopularLocations('drop');
    if (popularLocations[index]) {
      state.drop = popularLocations[index].description;
      
      // Add to user history
      addToUserHistory(from, popularLocations[index].description, 'drop');
      
      await calculateDistanceAndShowVehicles(from);
    }
  }
  
  // Handle pickup search suggestions
  else if (listId.startsWith('pickup_suggestion_')) {
    const index = parseInt(listId.split('_')[2]);
    const suggestions = await getLocationSuggestions(state.pickupSearchText);
    if (suggestions && suggestions[index]) {
      state.pickup = suggestions[index].description;
      
      // Add to user history
      addToUserHistory(from, suggestions[index].description, 'pickup');
      
      return sendSmartDropSuggestions(from, suggestions[index].description);
    }
  }
  
  // Handle drop search suggestions
  else if (listId.startsWith('drop_suggestion_')) {
    const index = parseInt(listId.split('_')[2]);
    const suggestions = await getLocationSuggestions(state.dropSearchText);
    if (suggestions && suggestions[index]) {
      state.drop = suggestions[index].description;
      
      // Add to user history
      addToUserHistory(from, suggestions[index].description, 'drop');
      
      await calculateDistanceAndShowVehicles(from);
    }
  }
  
  // Handle vehicle selection
  else if (listId === 'sedan' || listId === 'suv' || listId === 'tempo') {
    state.vehicle = listId;
    state.stage = 'mobile';
    return sendMessage(from, '📱 *MOBILE NUMBER*\n\nPlease enter your mobile number:\n\n📝 *Example:* 9876543210\n💡 *Note:* 10-digit Indian number');
  }
  
  return sendMessage(from, '❌ Invalid selection. Please try again or type "trip" to restart.');
}

// ==================== CATEGORY AND SMART SUGGESTION HANDLERS ====================

async function handleCategoryLocationSelection(from, listId) {
  const state = userStates[from];
  const parts = listId.split('_');
  const type = parts[0]; // pickup or drop
  const category = parts[1]; // airports, stations, etc.
  const index = parseInt(parts[2]);
  
  const locations = locationCategories[category];
  if (locations && locations[index]) {
    const selectedLocation = locations[index];
    
    if (type === 'pickup') {
      state.pickup = selectedLocation.address;
      
      // Add to user history
      addToUserHistory(from, selectedLocation.address, 'pickup');
      
      return sendSmartDropSuggestions(from, selectedLocation.address);
    } else {
      state.drop = selectedLocation.address;
      
      // Add to user history
      addToUserHistory(from, selectedLocation.address, 'drop');
      
      await calculateDistanceAndShowVehicles(from);
    }
  }
  
  return sendMessage(from, '❌ Invalid location selection. Please try again.');
}

async function handleSmartDropSelection(from, listId) {
  const state = userStates[from];
  
  // Extract category and index from listId like "smart_drop_airports_0"
  const parts = listId.split('_');
  if (parts.length >= 4) {
    const category = parts[2];
    const index = parseInt(parts[3]);
    
    const suggestions = getPopularRoutesFromPickup(state.pickup);
    const groupedSuggestions = groupSuggestionsByCategory(suggestions);
    
    // Find the suggestion in the correct category
    for (const [cat, items] of Object.entries(groupedSuggestions)) {
      if (cat.toLowerCase().replace(' ', '') === category && items[index]) {
        state.drop = items[index].address;
        
        // Add to user history
        addToUserHistory(from, items[index].address, 'drop');
        
        await calculateDistanceAndShowVehicles(from);
        return;
      }
    }
  }
  
  return sendMessage(from, '❌ Invalid destination selection. Please try again.');
}

// ==================== EXISTING WHATSAPP UI FUNCTIONS (ENHANCED) ====================

async function sendLocationSuggestions(to, suggestions, type, headerText) {
  // Add popular locations as first options
  const popularLocations = getPopularLocations(type);
  
  // WhatsApp limit: maximum 10 rows total
  const maxRows = 10;
  let availableRows = maxRows;
  
  const sections = [];
  
  // Add popular locations section (limit to 4 to leave space for search results)
  if (popularLocations.length > 0) {
    const limitedPopular = popularLocations.slice(0, Math.min(4, availableRows));
    sections.push({
      title: 'Popular Locations',
      rows: limitedPopular
    });
    availableRows -= limitedPopular.length;
  }
  
  // Add search suggestions section (use remaining rows)
  if (suggestions.length > 0 && availableRows > 0) {
    const processedSuggestions = suggestions.slice(0, availableRows).map((suggestion, index) => ({
      id: `${type}_suggestion_${index}`,
      title: truncateText(suggestion.main_text, 24), // WhatsApp limit
      description: truncateText(suggestion.secondary_text, 72) // WhatsApp description limit
    }));
    
    if (processedSuggestions.length > 0) {
      sections.push({
        title: 'Search Results',
        rows: processedSuggestions
      });
    }
  }

  // Add utility options
  const utilityRows = [];
  
  if (type === 'pickup') {
    utilityRows.push({
      id: 'share_gps_pickup',
      title: '📍 Share GPS Location',
      description: 'Use current location'
    });
    utilityRows.push({
      id: 'categories_pickup',
      title: '🏢 Browse Categories',
      description: 'Airports, Stations, Malls'
    });
  } else {
    utilityRows.push({
      id: 'share_gps_drop',
      title: '📍 Share GPS Location',
      description: 'Use current location'
    });
    utilityRows.push({
      id: 'categories_drop',
      title: '🏢 Browse Categories',
      description: 'Airports, Stations, Malls'
    });
  }

  if (utilityRows.length > 0 && sections.length < 3) {
    sections.push({
      title: 'Other Options',
      rows: utilityRows.slice(0, maxRows - countTotalRows(sections))
    });
  }

  // Ensure we have at least one section
  if (sections.length === 0) {
    sections.push({
      title: 'Try Again',
      rows: [{
        id: `${type}_retry`,
        title: '🔄 Try Different Keywords',
        description: 'Type more specific location'
      }]
    });
  }

  const message = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: headerText + '\n\n💡 Or try GPS sharing for accuracy!'
      },
      action: {
        button: 'Choose Location',
        sections: sections
      }
    }
  };

  return sendInteractiveMessage(to, message);
}

function getPopularLocations(type) {
  const popularPickupLocations = [
    { id: 'pickup_popular_0', title: '✈️ Pune Airport', description: 'Pune Airport (Lohegaon)' },
    { id: 'pickup_popular_1', title: '🚆 Pune Station', description: 'Pune Railway Station' },
    { id: 'pickup_popular_2', title: '✈️ Mumbai Airport', description: 'Chhatrapati Shivaji Airport' },
    { id: 'pickup_popular_3', title: '🏢 Hinjewadi IT Park', description: 'Hinjewadi Phase 1, Pune' }
  ];

  const popularDropLocations = [
    { id: 'drop_popular_0', title: '✈️ Mumbai Airport', description: 'Chhatrapati Shivaji Airport' },
    { id: 'drop_popular_1', title: '🚆 Mumbai Central', description: 'Mumbai Central Railway' },
    { id: 'drop_popular_2', title: '✈️ Pune Airport', description: 'Pune Airport (Lohegaon)' },
    { id: 'drop_popular_3', title: '✈️ Delhi Airport', description: 'Indira Gandhi Airport' }
  ];

  return type === 'pickup' ? popularPickupLocations : popularDropLocations;
}

async function calculateDistanceAndShowVehicles(from) {
  const state = userStates[from];
  
  // Show loading message
  await sendMessage(from, '🔄 Calculating distance and fare... Please wait.');
  
  // Calculate distance
  const distance = await getDistance(state.pickup, state.drop);
  if (!distance) {
    state.stage = 'drop_search';
    return sendMessage(from, '❌ Sorry, couldn\'t calculate distance. Please try different locations.\n\n📍 Type your drop location again:');
  }
  
  state.distance = distance;
  state.stage = 'vehicle';
  return sendVehicleOptionsWithFare(from, distance);
}

async function sendVehicleOptionsWithFare(to, distance) {
  const fareCalculations = Object.keys(vehicles).map(vehicleKey => {
    const vehicle = vehicles[vehicleKey];
    const baseFare = Math.round(parseFloat(distance) * vehicle.price);
    return {
      key: vehicleKey,
      name: vehicle.name,
      price: vehicle.price,
      capacity: vehicle.capacity,
      baseFare: baseFare
    };
  });

  const message = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: `🛣️ **Distance:** ${distance} km\n💰 **Estimated fares shown below:**\n\nChoose your vehicle:`
      },
      action: {
        button: 'Select Vehicle',
        sections: [
          {
            title: 'Available Vehicles',
            rows: fareCalculations.map(calc => ({
              id: calc.key,
              title: `${getVehicleEmoji(calc.key)} ${calc.name}`,
              description: `₹${calc.baseFare} • ${calc.capacity}`
            }))
          }
        ]
      }
    }
  };

  return sendInteractiveMessage(to, message);
}

async function showBookingSummary(from) {
  const state = userStates[from];
  
  // Calculate final fare
  let totalKm = parseFloat(state.distance);
  if (state.tripType === 'roundtrip') {
    totalKm *= 2;
  }
  
  const farePerKm = vehicles[state.vehicle].price;
  const totalFare = Math.round(totalKm * farePerKm);
  
  state.totalKm = totalKm;
  state.totalFare = totalFare;
  state.stage = 'confirm';

  const summaryText = `🎯 *BOOKING SUMMARY*

👤 *Contact Details:*
📱 Mobile: ${state.mobile}

🗺️ *Trip Details:*
📍 Pickup: ${truncateText(state.pickup, 40)}
📍 Drop: ${truncateText(state.drop, 40)}
🚗 Vehicle: ${vehicles[state.vehicle].name}
📏 Trip Type: ${state.tripType.toUpperCase()}
📐 Distance: ${totalKm} km

💰 *Fare Breakdown:*
Rate: ₹${farePerKm}/km
Total Distance: ${totalKm} km
*TOTAL FARE: ₹${totalFare}*

━━━━━━━━━━━━━━━━━━━━━
Please confirm your booking:`;

  const message = {
    messaging_product: 'whatsapp',
    to: from,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: summaryText
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: 'confirm_booking',
              title: '✅ CONFIRM'
            }
          },
          {
            type: 'reply',
            reply: {
              id: 'cancel_booking',
              title: '❌ CANCEL'
            }
          }
        ]
      }
    }
  };

  return sendInteractiveMessage(from, message);
}

async function createWhatsAppBooking(from) {
  const state = userStates[from];
  const bookingId = 'WTL' + Date.now().toString().slice(-6);

  const booking = {
    bookingId,
    platform: 'whatsapp',
    customerPhone: from,
    // email removed
    mobile: state.mobile,
    pickup: state.pickup,
    drop: state.drop,
    tripType: state.tripType,
    vehicle: vehicles[state.vehicle].name,
    distance: state.distance,
    totalKm: state.totalKm,
    totalFare: state.totalFare,
    status: 'confirmed',
    createdAt: new Date().toISOString()
  };

  bookings[bookingId] = booking;

  // Update user's location history with booking data
  addToUserHistory(from, state.pickup, 'pickup');
  addToUserHistory(from, state.drop, 'drop');

  // Send booking notification to business
  await sendBookingNotificationToWhatsApp(booking);

  // Send confirmation to customer
  const confirmationText = `🎉 *BOOKING CONFIRMED!*

🎫 *Booking ID:* ${bookingId}
📱 *Our Contact:* +91 91300 30054

✅ Your ride has been booked successfully!
📞 We will contact you shortly to arrange the pickup.

💡 *Need another trip?* Just type "trip"

*Thank you for choosing WorldTripLink!* 🚗`;

  await sendMessage(from, confirmationText);
  
  delete userStates[from];
}

// ==================== HELPER FUNCTIONS ====================

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`;
    const response = await axios.get(url);
    
    if (response.data.status === 'OK' && response.data.results.length > 0) {
      return response.data.results[0].formatted_address;
    }
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

function getLocationEmoji(type) {
  const emojis = {
    airport: '✈️',
    station: '🚆',
    mall: '🛒',
    office: '🏢',
    hotel: '🏨'
  };
  return emojis[type] || '📍';
}

function getCategoryEmoji(category) {
  const emojis = {
    airports: '✈️',
    stations: '🚆',
    malls: '🛒',
    itparks: '🏢',
    hotels: '🏨'
  };
  return emojis[category] || '🏢';
}

function getPopularRoutesFromPickup(pickup) {
  const cleanPickup = pickup.toLowerCase();
  
  // Try to match with popular routes database
  for (const [key, routes] of Object.entries(popularRoutesDB)) {
    if (cleanPickup.includes(key) || key.includes(cleanPickup.split(',')[0].trim())) {
      return routes;
    }
  }
  
  // Return empty array if no matches found
  return [];
}

function groupSuggestionsByCategory(suggestions) {
  const grouped = {};
  suggestions.forEach(suggestion => {
    if (!grouped[suggestion.category]) {
      grouped[suggestion.category] = [];
    }
    grouped[suggestion.category].push(suggestion);
  });
  return grouped;
}

function saveUserLocationHistory(userId, history) {
  // In production, save to database
  userLocationHistory[userId] = history;
}

function addToUserHistory(userId, location, type) {
  if (!userLocationHistory[userId]) {
    userLocationHistory[userId] = { recent: [], frequent: [] };
  }

  const history = userLocationHistory[userId];
  
  // Extract location name (first part before comma)
  const locationName = location.split(',')[0].trim();
  
  // Check if location already exists in recent
  const existingIndex = history.recent.findIndex(loc => 
    loc.address.toLowerCase().includes(locationName.toLowerCase()) ||
    locationName.toLowerCase().includes(loc.name.toLowerCase())
  );

  if (existingIndex !== -1) {
    // Move to front and increment count
    const existing = history.recent.splice(existingIndex, 1)[0];
    existing.count = (existing.count || 0) + 1;
    existing.lastUsed = new Date().toISOString();
    history.recent.unshift(existing);
  } else {
    // Add new location to front
    history.recent.unshift({
      name: locationName,
      address: location,
      type: type,
      count: 1,
      lastUsed: new Date().toISOString()
    });
  }

  // Keep only last 10 recent locations
  history.recent = history.recent.slice(0, 10);
  
  saveUserLocationHistory(userId, history);
}

function getVehicleEmoji(vehicleKey) {
  const emojis = {
    sedan: '🚗',
    suv: '🚙', 
    tempo: '🚐'
  };
  return emojis[vehicleKey] || '🚗';
}

function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length <= maxLength ? text : text.substring(0, maxLength - 3) + '...';
}

async function getLocationSuggestions(input) {
  try {
    if (!input || input.length < 2) return null;
    
    // Clean and prepare the input
    const cleanInput = input.trim().toLowerCase();
    
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(cleanInput)}&key=${GOOGLE_API_KEY}&components=country:in&language=en&types=establishment|geocode`;
    
    console.log(`Fetching location suggestions for: ${cleanInput}`);
    const response = await axios.get(url);
    
    if (response.data.status === 'OK' && response.data.predictions) {
      console.log(`Found ${response.data.predictions.length} suggestions`);
      return response.data.predictions.map(prediction => ({
        description: prediction.description,
        main_text: prediction.structured_formatting.main_text || prediction.description,
        secondary_text: prediction.structured_formatting.secondary_text || ''
      }));
    } else {
      console.log(`Google API returned status: ${response.data.status}`);
      return null;
    }
  } catch (error) {
    console.error('Location suggestions error:', error.message);
    return null;
  }
}

async function sendMessage(to, message) {
  try {
    await axios.post(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
      messaging_product: 'whatsapp',
      to,
      text: { body: message }
    }, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    });
  } catch (error) {
    console.error('Send message error:', error.response?.data || error.message);
  }
}

async function sendInteractiveMessage(to, message) {
  try {
    const response = await axios.post(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, message, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    });
    console.log(`✅ Interactive message sent successfully to ${to}`);
    return response;
  } catch (error) {
    console.error('❌ Send interactive message error:', error.response?.data || error.message);
    
    // Specific error handling for common WhatsApp issues
    if (error.response?.data?.error?.code === 131009) {
      const errorDetail = error.response.data.error.error_data?.details || '';
      console.log(`📝 WhatsApp format error: ${errorDetail}`);
      
      // Fallback to simple text message
      const fallbackText = `❌ Sorry, there was an issue displaying the options. Please type your selection manually or try again.\n\nType "trip" to restart booking.`;
      return await sendMessage(to, fallbackText);
    }
    
    // For other errors, also fallback to text
    const fallbackText = `❌ Something went wrong. Please type "trip" to restart or contact support: +91 91300 30054`;
    return await sendMessage(to, fallbackText);
  }
}

async function getDistance(from, to) {
  try {
    console.log(`🛣️ Calculating distance from: ${from} to: ${to}`);
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(from)}&destinations=${encodeURIComponent(to)}&key=${GOOGLE_API_KEY}&units=metric`;
    const res = await axios.get(url);
    
    console.log(`📊 Distance API Status: ${res.data.status}`);
    
    if (res.data.status === 'OK' && res.data.rows[0]?.elements[0]?.status === 'OK') {
      const dist = res.data.rows[0].elements[0].distance.value;
      const distanceKm = (dist / 1000).toFixed(1);
      console.log(`✅ Distance calculated: ${distanceKm} km`);
      return distanceKm;
    } else {
      console.log(`❌ Distance calculation failed: ${res.data.rows[0]?.elements[0]?.status}`);
      return null;
    }
  } catch (e) {
    console.error('❌ Distance API error:', e.message);
    return null;
  }
}

async function sendBookingNotificationToWhatsApp(booking) {
  const notificationText = `🚖 *NEW BOOKING ALERT*

🎫 *Booking ID:* ${booking.bookingId}
⭐ *Platform:* ${booking.platform?.toUpperCase() || 'WEB'}

👤 *Customer Details:*
📱 Phone: ${booking.customerPhone || booking.mobile}
📧 Email: ${booking.email}
📞 Mobile: ${booking.mobile}

🗺️ *Trip Information:*
📍 Pickup: ${booking.pickup}
📍 Drop: ${booking.drop}
🚗 Vehicle: ${booking.vehicle}
📏 Trip: ${booking.tripType?.toUpperCase()}
📐 Distance: ${booking.distance} km (Total: ${booking.totalKm} km)

💰 *Fare Details:*
Rate: ₹${booking.farePerKm || vehicles[Object.keys(vehicles).find(v => vehicles[v].name === booking.vehicle)]?.price}/km
*TOTAL: ₹${booking.totalFare}*

📅 *Booking Time:* ${new Date(booking.createdAt).toLocaleString('en-IN')}
📅 *Pickup Date:* ${booking.pickupDate || 'ASAP'}
⏰ *Pickup Time:* ${booking.pickupTime || 'ASAP'}

━━━━━━━━━━━━━━━━━━━━━
🔥 *ACTION REQUIRED* 🔥
Contact customer immediately!`;

  await sendMessage(CONTACT_FORWARD_NUMBER, notificationText);
}

function isValidMobile(mobile) {
  // Remove all non-digits
  const cleanMobile = mobile.replace(/\D/g, '');
  
  // Check if it's a valid Indian mobile number
  // 10 digits starting with 6,7,8,9 OR 11 digits starting with 91 followed by 6,7,8,9
  const tenDigitRegex = /^[6-9]\d{9}$/;
  const elevenDigitRegex = /^91[6-9]\d{9}$/;
  
  return tenDigitRegex.test(cleanMobile) || elevenDigitRegex.test(cleanMobile);
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Add a helper function to count total rows in sections
function countTotalRows(sections) {
  return sections.reduce((total, section) => total + section.rows.length, 0);
}

// ==================== SERVER START ====================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚗 WorldTripLink Enhanced Backend running on port ${PORT}`);
  console.log(`📱 WhatsApp webhook: /webhook`);
  console.log(`🌐 Web API: /api/*`);
  console.log(`✨ Enhanced features: GPS sharing, Smart suggestions, Location categories, Recent history`);
});

// Export for testing
module.exports = app;