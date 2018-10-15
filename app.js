var AWS = require('aws-sdk');
const express = require('express');
const app = express();
const port= 3000;
const request = require('request');
const moment = require('moment');
var schedule = require('node-schedule');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

app.get('/', (req, res) => res.send('Hello World!'));

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

let utcTime = moment.utc().hour(3).minutes(0);
let localHour = utcTime.local().hour();

console.log(localHour);
// let repeatAt ={hour: 11, minute: 25, tz:'Asia/Seoul'};
// let repeatAt ={hour: 15, minute: 39, tz:'Pacific/Auckland'};
// let repeatAt ={hour: 16, minute: 15, tz:'Europe/London'};
let repeatAt ={hour: localHour, minute: 37};


// var j = schedule.scheduleJob('21 1 * * *','Europe/London', function(){
var j = schedule.scheduleJob(repeatAt, function(){
    request('https://api.coingecko.com/api/v3/exchanges/bithumb', function (error, response, body) {
        if (!error && response.statusCode === 200) {
            generateCSV(JSON.parse(body));
            // res.send("done");
        }
    });
});

app.get('/generate',(req,res)=>{

    request('https://api.coingecko.com/api/v3/exchanges/bithumb', function (error, response, body) {
        if (!error && response.statusCode === 200) {
            generateCSV(JSON.parse(body));
            res.send("done");
        }
    });


});

function generateCSV(returnValue){
    let momentTime = moment.utc().format('YYYYMMDDHHmm');
    // let momentTime = moment().format('YYYYMMDDHHmm');
    let exchangeName = returnValue.name;
    const csvWriter = createCsvWriter({
        path: './'+exchangeName+'_'+momentTime+'.csv',
        header: [
            {id: 'base', title: 'Base'},
            {id: 'target', title: 'Target'},
            {id: 'volume', title: 'Volume'}
        ]
    });

    const records = [];
    records.push({volume:returnValue.trade_volume_24h_btc});
    for(let record of returnValue.tickers){
        records.push({base:record.base, target:record.target, volume:record.converted_volume.usd});
    }

    csvWriter.writeRecords(records)       // returns a promise
        .then(() => {
            console.log('...Done');
        });
}