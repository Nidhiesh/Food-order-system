const { Client } = require('pg');

const passwords = ['postgres', 'admin', 'root', 'password', '123456', '', 'Nidhiesh', 'nidhiesh'];

async function testPasswords() {
  for (const pw of passwords) {
    const client = new Client({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: pw,
      database: 'postgres' // connect to default db first
    });

    try {
      await client.connect();
      console.log(`SUCCESS: Working password is "${pw}"`);
      await client.end();
      return;
    } catch (err) {
      console.log(`Failed with password "${pw}": ${err.message}`);
    }
  }
  console.log('None of the default passwords worked.');
}

testPasswords();
