const setupPrinter = require(`./print.js`);
const bodyParser = require(`body-parser`);
const express = require(`express`);

const meta = {
  isReady: false,
  setupFailed: null,
  fns: {
    printOrder: () => {},
    printQrCode: () => {},
    printWelcome: () => {}
  }
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
  } else {
    res.json({
      isAvailable: true
    });
  }
});

app.get(`/welcome`, (req, res) => {
  meta.fns.printWelcome();
  res.json({ done: meta.isReady && !meta.setupFailed });
});

app.post(`/order`, (req, res) => {
  const { order, tableName } = req.body;
  meta.fns.printOrder(order, tableName);
  res.json({ done: meta.isReady && !meta.setupFailed });
});

app.post(`/qr-code`, (req, res) => {
  meta.fns.printQrCode(req.body);
  res.json({ done: meta.isReady && !meta.setupFailed });
});

console.log(`App listening on port 4242`);

app.listen(4242);
