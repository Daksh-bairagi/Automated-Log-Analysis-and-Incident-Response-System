const nodemailer = require('nodemailer');
const dns = require('dns');

async function testEmail() {
  console.log("Testing Email...");
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      dnsLookup: (hostname, options, callback) => {
        dns.lookup(hostname, { ...options, family: 4 }, callback);
      },
      auth: {
        user: 'helloarav82@gmail.com',
        pass: 'rrryhognycimwadr',
      },
    });

    await transporter.verify();
    console.log("SMTP OK!");
    
    // Attempt send
    /*
    await transporter.sendMail({
      from: 'helloarav82@gmail.com',
      to: 'helloarav82@gmail.com',
      subject: 'Test Email',
      text: 'Working'
    });
    console.log("Mail sent.");
    */
  } catch (e) {
    console.error("Email Error:", e.message);
  }
}

async function testGChat() {
  console.log("Testing Google Chat...");
  try {
    const res = await fetch("https://chat.googleapis.com/v1/spaces/AAQAwTf0QXU/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=Aq9Xlsdzl_tfGfhSIaK80oFNbtBKvg7c8-dmL3tRK1o", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: "Test Message from Node" })
    });
    console.log("GChat Status:", res.status);
    const body = await res.text();
    console.log("GChat Response:", body);
  } catch(e) {
    console.error("GChat Error:", e.message);
  }
}

async function run() {
  await testEmail();
  await testGChat();
}

run();
