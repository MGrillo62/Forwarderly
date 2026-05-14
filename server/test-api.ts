async function test() {
  try {
    const login = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'myv.usuario', password: 'admin123' })
    }).then(r => r.json());
    
    const token = login.token;
    console.log('Logged in, creating category...');

    const res = await fetch('http://localhost:5000/api/categorias', { 
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Test Category' })
    }).then(async r => {
      if (!r.ok) {
         console.log(await r.text());
         throw new Error("HTTP " + r.status);
      }
      return r.json();
    });
    
    console.log('Category created:', res);
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

test();
