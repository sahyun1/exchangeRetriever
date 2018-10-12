var AWS = require('aws-sdk');
const express = require('express');
const app = express();
const request = require('request');
const moment = require('moment');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

app.get('/', (req, res) => res.send('Hello World!'));

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

app.get('/generate',(req,res)=>{

    request('https://api.coingecko.com/api/v3/exchanges/bithumb', function (error, response, body) {
        if (!error && response.statusCode === 200) {
            generateCSV(JSON.parse(body));
            res.send("done");
        }
    });


});

function generateCSV(returnValue){
    let momentTime = moment.utc().format('YYYYMMDDhhmm');

    const csvWriter = createCsvWriter({
        path: './tradingVolume_'+momentTime+'.csv',
        header: [
            {id: 'base', title: 'Base'},
            {id: 'target', title: 'Target'},
            {id: 'volume', title: 'Volume'}
        ]
    });

    const records = [];
    for(let record of returnValue.tickers){
        records.push({base:record.base, target:record.target, volume:record.volume});
    }

    csvWriter.writeRecords(records)       // returns a promise
        .then(() => {
            console.log('...Done');
        });
}