import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Authentication token is required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Normalize token payload so controllers can read req.user.userId / req.user.id and req.user.username
        // Token payloads vary; support common shapes: { userId }, { id }, { phoneNumber }, { full_name }
        const normalizedId = decoded.userId || decoded.id || null;
        const normalizedUsername = decoded.full_name || decoded.username || decoded.phoneNumber || null;
        req.user = {
            id: normalizedId,
            userId: normalizedId,
            username: normalizedUsername,
            full_name: decoded.full_name || null,
            raw: decoded
        };
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};