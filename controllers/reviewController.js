const db = require('../config/db');

const ensureReviewTables = async (executor = db) => {
    await executor.execute(`
        CREATE TABLE IF NOT EXISTS guest_reviews (
            review_id INT AUTO_INCREMENT PRIMARY KEY,
            booking_id INT NOT NULL,
            guest_id INT NOT NULL,
            overall_rating TINYINT NOT NULL,
            cleanliness_rating TINYINT NOT NULL,
            dining_rating TINYINT NOT NULL,
            staff_rating TINYINT NOT NULL,
            title VARCHAR(160) NULL,
            comment TEXT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'Pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            moderated_at DATETIME NULL,
            UNIQUE KEY uq_review_booking (booking_id),
            KEY idx_review_status (status),
            KEY idx_review_guest (guest_id)
        )
    `);
};

const normalizeRating = (value) => {
    const rating = Number(value);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new Error('Ratings must be whole numbers from 1 to 5.');
    }
    return rating;
};

const getEligibleReviews = async (req, res) => {
    try {
        await ensureReviewTables();
        const [bookings] = await db.execute(
            `SELECT
                b.booking_id,
                b.check_in,
                b.check_out,
                r.room_number,
                r.type AS room_type
             FROM bookings b
             JOIN rooms r ON r.room_id = b.room_id
             LEFT JOIN guest_reviews gr ON gr.booking_id = b.booking_id
             WHERE b.guest_id = ?
               AND b.status = 'Completed'
               AND gr.review_id IS NULL
             ORDER BY b.check_out DESC
             LIMIT 5`,
            [req.user.id]
        );

        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const submitGuestReview = async (req, res) => {
    const { booking_id, overall_rating, cleanliness_rating, dining_rating, staff_rating, title, comment } = req.body;

    try {
        await ensureReviewTables();
        const ratings = {
            overall: normalizeRating(overall_rating),
            cleanliness: normalizeRating(cleanliness_rating),
            dining: normalizeRating(dining_rating),
            staff: normalizeRating(staff_rating)
        };

        const [bookings] = await db.execute(
            `SELECT booking_id FROM bookings
             WHERE booking_id = ? AND guest_id = ? AND status = 'Completed'`,
            [booking_id, req.user.id]
        );
        if (bookings.length === 0) {
            return res.status(400).json({ error: 'Only completed stays can be reviewed.' });
        }

        await db.execute(
            `INSERT INTO guest_reviews
             (booking_id, guest_id, overall_rating, cleanliness_rating, dining_rating, staff_rating, title, comment)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                booking_id,
                req.user.id,
                ratings.overall,
                ratings.cleanliness,
                ratings.dining,
                ratings.staff,
                title ? String(title).trim() : null,
                comment ? String(comment).trim() : null
            ]
        );

        res.status(201).json({ message: 'Thank you. Your review is awaiting moderation.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'This stay has already been reviewed.' });
        }
        res.status(400).json({ error: error.message });
    }
};

const getPublicReviews = async (req, res) => {
    try {
        await ensureReviewTables();
        const [reviews] = await db.execute(
            `SELECT
                gr.review_id,
                gr.overall_rating,
                gr.cleanliness_rating,
                gr.dining_rating,
                gr.staff_rating,
                gr.title,
                gr.comment,
                gr.created_at,
                g.name AS guest_name,
                r.type AS room_type
             FROM guest_reviews gr
             JOIN guests g ON g.guest_id = gr.guest_id
             JOIN bookings b ON b.booking_id = gr.booking_id
             JOIN rooms r ON r.room_id = b.room_id
             WHERE gr.status = 'Approved'
             ORDER BY gr.created_at DESC
             LIMIT 12`
        );

        res.json(reviews);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getAdminReviews = async (req, res) => {
    try {
        await ensureReviewTables();
        const [reviews] = await db.execute(
            `SELECT
                gr.*,
                g.name AS guest_name,
                r.room_number,
                r.type AS room_type
             FROM guest_reviews gr
             JOIN guests g ON g.guest_id = gr.guest_id
             JOIN bookings b ON b.booking_id = gr.booking_id
             JOIN rooms r ON r.room_id = b.room_id
             ORDER BY FIELD(gr.status, 'Pending', 'Approved', 'Rejected'), gr.created_at DESC`
        );

        res.json(reviews);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const moderateReview = async (req, res) => {
    const { review_id } = req.params;
    const { status } = req.body;
    const normalizedStatus = ['Pending', 'Approved', 'Rejected'].includes(status) ? status : null;

    if (!normalizedStatus) {
        return res.status(400).json({ error: 'Status must be Pending, Approved, or Rejected.' });
    }

    try {
        await ensureReviewTables();
        await db.execute(
            `UPDATE guest_reviews
             SET status = ?, moderated_at = NOW()
             WHERE review_id = ?`,
            [normalizedStatus, review_id]
        );

        res.json({ message: `Review marked ${normalizedStatus}.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    ensureReviewTables,
    getEligibleReviews,
    submitGuestReview,
    getPublicReviews,
    getAdminReviews,
    moderateReview
};
