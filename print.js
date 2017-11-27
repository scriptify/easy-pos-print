const path = require(`path`);
const promisify = require(`promisify-node`);
const fs = require(`fs`);
const dateFormat = require(`dateformat`);
const svg2png = require(`svg2png`);
const escpos = require(`escpos`);
const http = require(`http`);
const https = require(`https`);
const Stream = require(`stream`).Transform;

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const MAX_CHARS_PER_LINE = 55;
const MAX_CHARS_PER_LINE_BIG_FONT = 35;

function replaceUnsupportedVals(str) {
  const vals = [`ä`, `Ä`, `ö`, `Ö`, `ü`, `Ü`, `ß`];
  const replaceWith = [`ae`, `Ae`, `oe`, `Oe`, `ue`, `Ue`, `ss`];

  let retStr = str;
  vals.forEach((val, i) => {
    retStr = retStr.replace(val, replaceWith[i]);
  });
  return retStr;
}

function charSeries(num, char) {
  return (new Array(num)).join(char);
}

function sameLines(strings, maxChars = MAX_CHARS_PER_LINE) {
  const strsLen = strings.reduce((acc, str) => acc + str.length, 0);
  const strsToConcat = strings.filter((s, i) => i !== (strings.length - 1));

  const charsBetween = Math.round((maxChars - strsLen) / strings.length);
  const concated = strsToConcat.reduce((acc, s2) => acc + s2 + charSeries(charsBetween, ` `), ``);

  const lastStr = strings[strings.length - 1];
  return concated + charSeries((maxChars - concated.length), ``) + lastStr;
}

function center(str, maxChars = MAX_CHARS_PER_LINE) {
  const newLen = str.length + ((maxChars - str.length) / 2);
  return str.padStart(newLen);
}

function printOrder(printer, order, tableName) {
  printer
    .encode(`UTF-8`)
    .size(2, 2)
    .text(`Tisch ${replaceUnsupportedVals(tableName)} (#${order.orderNum})`)
    .text(``)
    .size(1, 1);

  order.products.forEach(({ product, quantity }) => {
    printer.text(`${quantity}x    ${replaceUnsupportedVals(product.names[0].value)}`);
  });

  printer
    .text(``)
    .text(dateFormat(Date.now(), `dd/mm/yyyy HH:MM:ss`), `RT`)
    .text(``)
    .text(charSeries(MAX_CHARS_PER_LINE, `#`))
    .text(``)
    .text(``)
    .cut(true);

  /*try {
    printer.close();
  } catch (e) {
    // How to handle this case? I think it's ok if nothing is done
    console.error(`Couldn't close!`, e);
  }*/
}

function printQrCode(printer, { pathToSvg, pathToPng, height = 400, width = 400, tableName, tableCode, useHTTPS = false }) {
  const tempSvgPath = path.join(__dirname, `tempSVG.svg`);
  const protocolToUse = useHTTPS ? https : http;

  protocolToUse.request(pathToSvg, function(response) {
    var data = new Stream();

    response.on('data', function(chunk) {
      data.push(chunk);
    });

    response.on('end', function() {
      fs.writeFileSync(tempSvgPath, data.read());
      readFile(tempSvgPath)
        .then(buff => svg2png(buff, { width, height }))
        .then(buffer => writeFile(pathToPng, buffer))
        .then(() => {
          escpos.Image.load(pathToPng, (obj) => {
            printer
              .encode(`utf8`)
              .size(2, 2)
              .text(`Tisch ${tableName}`)
              .text(charSeries(24, `#`))
              .image(obj)
              .size(1, 1)
              .text(`Code ${tableCode}`)
              .text(``)
              .text(``)
              .cut()
              .close();
          });
        });
    });
  }).end();

}

function printWelcome(printer) {
  printer
    .encode(`utf8`)
    .size(2, 2)
    .text(``)
    .text(``)
    .text(``)
    .text(` Welcome!`)
    .text(``)
    .text(``)
    .text(``)
    .cut()
    .close();
}

function printReceipt(printer, order) {
  printer
    .encode(`utf8`)
    .size(1, 1);

  printer
    .text(``)
    .size(1, 1)
    .text(`Trattoria Silicon Valley`)
    .text(`Ordomatic S.R.L.`)
    .text(`Via localhost 127, 39043, Nowhere`)
    .text(`P. IVA 54354353453453`)
    .text(``)
    .text(``);

  printer
    .style(`bi`)
    .text(sameLines([`Quantita`, `Prodotto`, `EURO`]))
    .style(`NORMAL`);

  let overallToPay = 0;
  order.products.forEach((product) => {
    const priceToPay = (product.quantity - product.paidNum) * product.product.price;
    overallToPay += priceToPay;
    printer
      .text(sameLines([
        `${product.quantity}x${product.product.price.toFixed(2)}`,
        `${replaceUnsupportedVals(product.product.names[0].value)}`,
        `${priceToPay.toFixed(2)}`
      ]));
  });

  printer
    .text(`Tavolo ${order.tableName}`)
    .text(``)
    .style(`NORMAL`)
    .size(2, 2)
    .text(sameLines([`TOTALE`, `${overallToPay.toFixed(2)}`], MAX_CHARS_PER_LINE_BIG_FONT))
    .size(1, 1)
    .text(``)
    .text(dateFormat(Date.now(), `dd/mm/yyyy HH:MM:ss`))
    .text(`S.F. ${order.orderNum}`)
    .text(`MF 3453535364565`)
    .text(``)
    .text(``)
    .text(``)
    .cut(true)
    .close();


}

function setup() {
  return new Promise((resolve, reject) => {
    // Select the adapter based on your printer type
    let device;
    try {
      device = new escpos.USB();
    } catch (e) {
      reject({ error: `NO_PRINTER` });
    }
    try {
      const printer = new escpos.Printer(device);

      // monkeypatch text function
      const oldText = printer.text.bind(printer);
      printer.text = function newText(content, align = `LT`) {
        const splitted = content.split(` `);
        const stringsToPrint = [];
        for (let i = 0; i < splitted.length; i++) {
          const currIndex = stringsToPrint.length - 1;
          if (stringsToPrint[currIndex] && ((stringsToPrint[currIndex].length + splitted[i].length) < MAX_CHARS_PER_LINE))
            stringsToPrint[currIndex] += ` ${splitted[i]}`;
          else
            stringsToPrint.push(splitted[i]);
        }

        for (let i = 0; i < stringsToPrint.length; i += 1) {
          if (i >= 1)
            this.align(`CT`);
          else
            this.align(align);

          oldText(stringsToPrint[i]);
        }
        return this;
      };

      device.open(() => {
        resolve({
          printOrder: printOrder.bind(null, printer),
          printQrCode: printQrCode.bind(null, printer),
          printWelcome: printWelcome.bind(null, printer),
          printReceipt: printReceipt.bind(null, printer)
        });
      });
    } catch (e) {
      reject({ error: `ACCESS_FAILURE` });
    }
  });
}

module.exports = setup;
