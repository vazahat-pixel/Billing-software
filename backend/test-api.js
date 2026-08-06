const http = require('http');

function testLogin() {
  const loginData = JSON.stringify({
    email: 'qa.dev.admin@textileerp.dev',
    password: 'QaTenant@123'
  });

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length
    }
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Status Code:', res.statusCode);
      console.log('Response:', data);

      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log('\n✅ LOGIN WORKING! Backend API responds correctly');
        try {
          const json = JSON.parse(data);
          if (json.token) {
            console.log('✅ Token generated successfully');
            console.log('Copy this token to browser DevTools if needed');
          }
        } catch(e) {}
      } else {
        console.log('\n❌ Login endpoint returned error. Check backend logs.');
      }
    });
  });

  req.on('error', (error) => {
    console.error('Cannot connect to backend at localhost:5000');
    console.error('Make sure backend is running: npm start');
    console.error('Error:', error.message);
  });

  req.write(loginData);
  req.end();
}

console.log('Testing backend API...\n');
testLogin();
