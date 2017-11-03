const path = require(`path`);
const promisify = require(`promisify-node`);
const fs = require(`fs`);
const dateFormat = require(`dateformat`);
const svg2png = require(`svg2png`);
const escpos = require(`escpos`);
const http = require(`https`);
const Stream = require(`stream`).Transform;

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const MAX_CHARS_PER_LINE = 46;

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

function printQrCode(printer, { pathToSvg, pathToPng, height = 400, width = 400, tableName, tableCode }) {
  const tempSvgPath = path.join(__dirname, `tempSVG.svg`);
  http.request(pathToSvg, function(response) {
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
          printWelcome: printWelcome.bind(null, printer)
        });
      });
    } catch (e) {
      reject({ error: `ACCESS_FAILURE` });
    }
  });
}

module.exports = setup;
