const http = require('http');

function testLogin() {
  const loginData = JSON.stringify({
    email: 'owner208432@textileerp.com',
    password: 'Owner@i9z92o9'
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
      if (res.statusCode === 200) {
        console.log('✅ LOGIN SUCCESSFUL!');
        try {
          const json = JSON.parse(data);
          console.log(`Name: ${json.user.name}`);
          console.log(`Role: ${json.user.companyRole}`);
          console.log(`Company: ${json.user.company.name}`);
          console.log(`Token: ${json.token.substring(0, 50)}...`);
        } catch(e) {}
      } else {
        console.log(`❌ Status: ${res.statusCode}`);
        console.log('Error:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Cannot connect to backend');
    console.error('Error:', error.message);
  });

  req.write(loginData);
  req.end();
}

console.log('Testing owner login...\n');
testLogin();
