const db = require('../config/db');

const auditLogger = (action) => {
    return async (req, res, next) => {
        // Intercept the response to log only if successful
        const originalSend = res.send;
        res.send = function (body) {
            res.send = originalSend;
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
                // Log the action asynchronously
                try {
                    const userName = req.user?.name || req.user?.email || 'System/Guest';
                    const role = req.user?.role || 'Guest';
                    
                    let description = '';
                    if (req.method === 'POST') description = `Created resource via ${req.originalUrl}`;
                    if (req.method === 'PUT') description = `Updated resource via ${req.originalUrl}`;
                    if (req.method === 'DELETE') description = `Deleted resource via ${req.originalUrl}`;

                    db.query(
                        'INSERT INTO activity_logs (user_name, role, action, description) VALUES (?, ?, ?, ?)',
                        [userName, role, action, description]
                    ).catch(err => console.error('Audit Log DB Error:', err));
                } catch (e) {
                    console.error('Audit Log Error:', e);
                }
            }
            return res.send(body);
        };
        next();
    };
};

module.exports = auditLogger;
