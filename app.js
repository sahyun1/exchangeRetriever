var AWS = require('aws-sdk');
AWS.config.update({region: 'ap-southeast-2'});
// var myConfig = new AWS.Config();
// myConfig.update({region: 'southeast-2'});
var params = {
    Message: 'MESSAGE_TEXT', /* required */
    TopicArn: 'arn:aws:sns:ap-southeast-2:256368627721:exchangeRetriever'
};

const express = require('express');
const app = express();
const port = 3000;
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
let repeatAt = {hour: localHour, minute: 37};


// var j = schedule.scheduleJob('21 1 * * *','Europe/London', function(){
var j = schedule.scheduleJob(repeatAt, function () {
    request('https://api.coingecko.com/api/v3/exchanges/bithumb', function (error, response, body) {
        if (!error && response.statusCode === 200) {
            generateCSV(JSON.parse(body));
            // res.send("done");
        }
    });
});


app.get('/generate', (req, res) => {

    request('https://api.coingecko.com/api/v3/exchanges/bithumb', function (error, response, body) {
        if (!error && response.statusCode === 200) {
            generateCSV(JSON.parse(body));
            res.send("done");
            // var publishTextPromise = new AWS.SNS({apiVersion: '2010-03-31'}).publish(params).promise();
            // publishTextPromise.then(
            //     function(data) {
            //         console.log(`Message ${params.Message} send sent to the topic ${params.TopicArn}`);
            //         console.log("MessageID is " + data.MessageId);
            //     }).catch(
            //     function(err) {
            //         console.error(err, err.stack);
            //     });


        }
    });


});

function generateCSV(returnValue) {
    let momentTime = moment.utc().format('YYYYMMDDHHmm');
    // let momentTime = moment().format('YYYYMMDDHHmm');
    let exchangeName = returnValue.name;
    let fileName = exchangeName + '_' + momentTime+'.csv';
    const csvWriter = createCsvWriter({
        path: './' + fileName,
        header: [
            {id: 'base', title: 'Base'},
            {id: 'target', title: 'Target'},
            {id: 'volume', title: 'Volume'}
        ]
    });

    const records = [];
    records.push({volume: returnValue.trade_volume_24h_btc});
    for (let record of returnValue.tickers) {
        records.push({base: record.base, target: record.target, volume: record.converted_volume.usd});
    }

    csvWriter.writeRecords(records)       // returns a promise
        .then(() => {
            console.log('Writing file Done');
            uploadToS3(fileName);
        });
}

function uploadToS3(fileName){
    let s3 = new AWS.S3();

    // call S3 to retrieve upload file to specified bucket
    var uploadParams = {Bucket: 'exchange-retriever', Key: '', Body: ''};

    var fs = require('fs');
    var fileStream = fs.createReadStream('./' + fileName);
    fileStream.on('error', function(err) {
        console.log('File Error', err);
    });
    uploadParams.Body = fileStream;

    var path = require('path');
    uploadParams.Key = path.basename(fileName);
    // uploadParams.body =

    // call S3 to retrieve upload file to specified bucket
    s3.upload(uploadParams, function (err, data) {
        if (err) {
            console.log("Error", err);
        }
        if (data) {
            console.log("Upload Success", data.Location);
        }
    });
}