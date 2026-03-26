import jwt from 'jsonwebtoken';

(async () => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('No JWT_SECRET');
      process.exit(1);
    }

    const token = jwt.sign({ phoneNumber: '0000000000', userId: 1 }, secret, { expiresIn: '24h' });
    console.log('Using token:', token);

    const report = {
      issueType: 'litter',
      description: 'Automated test litter report',
      severity: 'low',
      keywords: 'test,litter',
      location: '21.2514,81.6296',
      photoHash: '[]',
      additionalData: '{}'
    };

    const resp = await fetch('http://localhost:5000/api/reports/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(report)
    });

    const data = await resp.json();
    console.log('Submit response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error during test submit:', e);
    process.exit(1);
  }
})();
