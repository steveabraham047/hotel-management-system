const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { ensurePublicTables } = require('../controllers/publicController');
const { getPricingRules, getOccupancyRate, calculateDynamicPrice } = require('../controllers/pricingController');

const defaultDetailsByType = {
    Standard: {
        title: 'Classic Comfort Room',
        capacity: 2,
        rating: 4.7,
        popular: false,
        image_url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=1400&auto=format&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=1400&auto=format&fit=crop'
        ],
        description: 'A calm and efficient room for short stays, business travel, and quiet city breaks.',
        amenities: ['Queen bed', 'Wi-Fi', 'Smart TV', 'Tea service'],
        included: ['Wi-Fi', 'Daily housekeeping', 'Tea service', 'Front desk support'],
        policy: 'Free cancellation until 24 hours before arrival. Check-out by 11 AM.'
    },
    Deluxe: {
        title: 'Signature King Room',
        capacity: 2,
        rating: 4.8,
        popular: false,
        image_url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1400&auto=format&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1400&auto=format&fit=crop'
        ],
        description: 'A refined king room with soft lighting, premium linens, and a work-friendly corner.',
        amenities: ['King bed', 'Work desk', 'Smart TV', 'City view'],
        included: ['Daily breakfast', 'Wi-Fi', 'Tea service', 'Late checkout on request'],
        policy: 'Flexible date changes subject to availability. Check-out by 11 AM.'
    },
    Suite: {
        title: 'Terrace Garden Suite',
        capacity: 3,
        rating: 4.9,
        popular: true,
        image_url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1400&auto=format&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=1400&auto=format&fit=crop'
        ],
        description: 'A calm private suite with garden-facing lounge space, warm textures, and quiet evening service.',
        amenities: ['Private terrace', 'King bed', 'Rain shower', 'Breakfast included'],
        included: ['Airport assistance', 'Evening turn-down', 'Welcome drink', 'High-speed Wi-Fi'],
        policy: 'Free cancellation until 24 hours before arrival. Check-in after 2 PM.'
    },
    Premium: {
        title: 'Signature Premium Room',
        capacity: 2,
        rating: 4.8,
        popular: false,
        image_url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1400&auto=format&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1400&auto=format&fit=crop'
        ],
        description: 'A refined premium room with soft lighting, premium linens, and a work-friendly corner.',
        amenities: ['King bed', 'Work desk', 'Smart TV', 'City view'],
        included: ['Daily breakfast', 'Wi-Fi', 'Tea service', 'Late checkout on request'],
        policy: 'Flexible date changes subject to availability. Check-out by 11 AM.'
    },
    Family: {
        title: 'Family Residence',
        capacity: 5,
        rating: 4.9,
        popular: false,
        image_url: 'https://images.unsplash.com/photo-1598928636135-d146006ff4be?q=80&w=1400&auto=format&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1598928636135-d146006ff4be?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1590490359683-658d34c8f11f?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1400&auto=format&fit=crop'
        ],
        description: 'A spacious residence with connected sleeping zones, generous seating, and family-friendly service touches.',
        amenities: ['Two bedrooms', 'Living area', 'Mini pantry', 'Kids amenities'],
        included: ['Breakfast for four', 'Kids welcome kit', 'Wi-Fi', 'Priority housekeeping'],
        policy: 'Free cancellation until 48 hours before arrival. Extra bed available on request.'
    },
    Luxury: {
        title: 'Presidential Retreat',
        capacity: 4,
        rating: 5,
        popular: true,
        image_url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=1400&auto=format&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1591088398332-8a7791972843?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1540518614846-7eded433c457?q=80&w=1400&auto=format&fit=crop'
        ],
        description: 'The flagship suite experience with private dining, dedicated service, and skyline views.',
        amenities: ['Private dining', 'Butler service', 'Soaking bath', 'Skyline view'],
        included: ['Personal concierge', 'Club lounge access', 'Chef-curated breakfast', 'Airport transfer'],
        policy: 'Deposit required. Free date change up to 72 hours before arrival.'
    }
};

const allowedTypes = Object.keys(defaultDetailsByType);

const getTypeDefaults = (type) => defaultDetailsByType[type] || defaultDetailsByType.Standard;

const parseList = (value, fallback = []) => {
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }

    if (typeof value !== 'string') {
        return fallback;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return fallback;
    }

    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
            return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
    } catch {
        // Fall back to staff-friendly comma/newline input.
    }

    return trimmed
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
};

const parseBoolean = (value) => value === true || value === 1 || value === '1' || value === 'true' || value === 'on';

const mapAdminRoom = (room) => {
    const defaults = getTypeDefaults(room.type);
    const gallery = parseList(room.gallery_json, defaults.gallery);
    const amenities = parseList(room.amenities_json, defaults.amenities);
    const included = parseList(room.included_json, defaults.included);

    return {
        ...room,
        price_per_night: Number(room.price_per_night),
        title: room.title || `${defaults.title} ${room.room_number}`,
        capacity: Number(room.capacity || defaults.capacity),
        rating: Number(room.rating || defaults.rating),
        popular: Boolean(room.popular),
        image_url: room.image_url || defaults.image_url,
        gallery,
        description: room.description || defaults.description,
        amenities,
        included,
        policy: room.policy || defaults.policy
    };
};

const buildPublicDetails = (body, roomNumber, type) => {
    const defaults = getTypeDefaults(type);
    const gallery = parseList(body.gallery ?? body.gallery_json, defaults.gallery);
    const amenities = parseList(body.amenities ?? body.amenities_json, defaults.amenities);
    const included = parseList(body.included ?? body.included_json, defaults.included);
    const imageUrl = String(body.image_url || body.image || gallery[0] || defaults.image_url).trim();

    return {
        title: String(body.title || `${defaults.title} ${roomNumber}`).trim(),
        capacity: Number(body.capacity || defaults.capacity),
        rating: Number(body.rating || defaults.rating),
        popular: parseBoolean(body.popular),
        image_url: imageUrl,
        gallery_json: JSON.stringify(gallery),
        description: String(body.description || defaults.description).trim(),
        amenities_json: JSON.stringify(amenities),
        included_json: JSON.stringify(included),
        policy: String(body.policy || defaults.policy).trim()
    };
};

const upsertPublicDetails = async (roomId, body, roomNumber, type) => {
    await ensurePublicTables();
    const details = buildPublicDetails(body, roomNumber, type);

    await db.query(
        `INSERT INTO room_public_details
         (room_id, title, capacity, rating, popular, image_url, gallery_json, description, amenities_json, included_json, policy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            capacity = VALUES(capacity),
            rating = VALUES(rating),
            popular = VALUES(popular),
            image_url = VALUES(image_url),
            gallery_json = VALUES(gallery_json),
            description = VALUES(description),
            amenities_json = VALUES(amenities_json),
            included_json = VALUES(included_json),
            policy = VALUES(policy)`,
        [
            roomId,
            details.title,
            details.capacity,
            details.rating,
            details.popular ? 1 : 0,
            details.image_url,
            details.gallery_json,
            details.description,
            details.amenities_json,
            details.included_json,
            details.policy
        ]
    );
};

// --- GET /api/rooms: Fetch all rooms ---
router.get('/', async (req, res) => {
    try {
        await ensurePublicTables();
        const rules = await getPricingRules();
        const occupancy = await getOccupancyRate();
        const [rooms] = await db.query(
            `SELECT
                r.room_id,
                r.room_number,
                r.type,
                r.price_per_night,
                r.status,
                d.title,
                d.capacity,
                d.rating,
                d.popular,
                d.image_url,
                d.gallery_json,
                d.description,
                d.amenities_json,
                d.included_json,
                d.policy
             FROM rooms r
             LEFT JOIN room_public_details d ON d.room_id = r.room_id
             ORDER BY CAST(r.room_number AS UNSIGNED), r.room_number`
        );
        res.json(rooms.map((room) => ({
            ...mapAdminRoom(room),
            ...calculateDynamicPrice(room.price_per_night, rules, occupancy.occupancyRate)
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- POST /api/rooms: Add a NEW room ---
router.post('/', async (req, res) => {
    const { room_number, type, price_per_night, status } = req.body;
    const normalizedType = allowedTypes.includes(type) ? type : 'Standard';

    try {
        const [result] = await db.query(
            'INSERT INTO rooms (room_number, type, price_per_night, status) VALUES (?, ?, ?, ?)',
            [room_number, normalizedType, price_per_night, status || 'Available']
        );
        await upsertPublicDetails(result.insertId, req.body, room_number, normalizedType);
        res.status(201).json({ message: 'Room created successfully', room_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to create room' });
    }
});

// --- PUT /api/rooms/:id: UPDATE an existing room ---
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { room_number, type, price_per_night, status } = req.body;
    const normalizedType = allowedTypes.includes(type) ? type : 'Standard';

    try {
        await db.query(
            'UPDATE rooms SET room_number = ?, type = ?, price_per_night = ?, status = ? WHERE room_id = ?',
            [room_number, normalizedType, price_per_night, status || 'Available', id]
        );
        await upsertPublicDetails(id, req.body, room_number, normalizedType);
        res.json({ message: 'Room updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to update room' });
    }
});

// --- DELETE /api/rooms/:id: DELETE a room ---
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM rooms WHERE room_id = ?', [id]);
        await db.query('DELETE FROM room_public_details WHERE room_id = ?', [id]);
        res.json({ message: 'Room deleted successfully' });
    } catch (err) {
        // Smart Database Protection: You can't delete a room if guests have stayed in it!
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ error: 'Cannot delete room: It has existing booking history. Change status to Maintenance instead.' });
        }
        res.status(500).json({ error: 'Failed to delete room' });
    }
});

module.exports = router;
