const setupPrinter = require(`./print.js`);
const bodyParser = require(`body-parser`);
const express = require(`express`);

const meta = {
  isReady: false,
  setupFailed: null
};

const app = express();
app.use(bodyParser.json());

setupPrinter()
  .then((fns) => {
    meta.isReady = true;
    meta.fns = fns;
  })
  .catch((e) => {
    meta.setupFailed = e;
  });

app.get(`/is-available`, (req, res) => {
  if (meta.setupFailed) {
    res.json({
      isAvailable: false,
      reason: meta.setupFailed
    });
  } else if(!meta.isReady) {
    res.json({
      isAvailable: false,
      reason: `NOT_READY`
    });
  }
  res.json({
    isAvailable: true
  });
});

app.get(`/welcome`, (req, res) => {
  setupPrinter()
    .then((fns) => {
      meta.isReady = true;
      fns.printWelcome();
      res.json({ done: true });
    })
    .catch((e) => {
      meta.setupFailed = e;
      res.json({ done: false });
    });
});

app.post(`/order`, (req, res) => {
  setupPrinter()
    .then((fns) => {
      meta.isReady = true;
      const { order, tableName, number } = req.body;
      fns.printOrder(order, tableName, number);
      res.json({ done: true });
    })
    .catch((e) => {
      meta.setupFailed = e;
      res.json({ done: false });
    });
});

app.post(`/qr-code`, (req, res) => {
  setupPrinter()
    .then((fns) => {
      meta.isReady = true;
      fns.printQrCode(req.body);
      res.json({ done: true });
    })
    .catch((e) => {
      meta.setupFailed = e;
      res.json({ done: false });
    });
});

console.log(`POS print server listening on port 4242`);

app.listen(4242);
