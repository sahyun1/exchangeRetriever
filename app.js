var AWS = require('aws-sdk');
AWS.config.update({region: 'ap-southeast-2'});
// var myConfig = new AWS.Config();
// myConfig.update({region: 'southeast-2'});

const express = require('express');
const app = express();
const port = 3000;
const request = require('request');
const moment = require('moment');
var schedule = require('node-schedule');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

app.get('/', (req, res) => res.send('Hello World!'));

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

let utcTime = moment.utc().hour(10).minutes(0);
let localHour = utcTime.local().hour();

console.log(localHour);
// let repeatAt ={hour: 11, minute: 25, tz:'Asia/Seoul'};
// let repeatAt ={hour: 15, minute: 39, tz:'Pacific/Auckland'};
// let repeatAt ={hour: 16, minute: 15, tz:'Europe/London'};
let repeatAt = {hour: localHour, minute: 0};


// var j = schedule.scheduleJob('21 1 * * *','Europe/London', function(){
var j = schedule.scheduleJob(repeatAt, function () {

    let retrieveVolumeArray = [];

    var bithumbPromise = retrieveVolume('https://api.coingecko.com/api/v3/exchanges/bithumb');
    var upbitPromise = retrieveVolume('https://api.coingecko.com/api/v3/exchanges/upbit');
    var huobiPromise = retrieveVolume('https://api.coingecko.com/api/v3/exchanges/huobi');
    var okexPromise = retrieveVolume('https://api.coingecko.com/api/v3/exchanges/okex');
    var liquidPromise = retrieveVolume('https://api.coingecko.com/api/v3/exchanges/liquid');

    retrieveVolumeArray.push(bithumbPromise, upbitPromise, huobiPromise, okexPromise, liquidPromise);

    Promise.all(retrieveVolumeArray).then((result)=>{
        console.log("all results are "+result);
        let uploadFileArray = [];

        for(let fileName of result){
            uploadFileArray.push(uploadToS3(fileName));
        }

        Promise.all(uploadFileArray).then(uploadLocations=>{
            // console.log(uploadLocations);
            sendEmail(uploadLocations);
            res.send("email sent");
        })

    })
});


app.get('/generate', (req, res) => {

    let retrieveVolumeArray = [];

    var bithumbPromise = retrieveVolume('https://api.coingecko.com/api/v3/exchanges/bithumb');
    var upbitPromise = retrieveVolume('https://api.coingecko.com/api/v3/exchanges/upbit');
    var huobiPromise = retrieveVolume('https://api.coingecko.com/api/v3/exchanges/huobi');
    var okexPromise = retrieveVolume('https://api.coingecko.com/api/v3/exchanges/okex');
    var liquidPromise = retrieveVolume('https://api.coingecko.com/api/v3/exchanges/liquid');

    retrieveVolumeArray.push(bithumbPromise, upbitPromise, huobiPromise, okexPromise, liquidPromise);

    Promise.all(retrieveVolumeArray).then((result)=>{
        console.log("all results are "+result);
        let uploadFileArray = [];

        for(let fileName of result){
            uploadFileArray.push(uploadToS3(fileName));
        }

        Promise.all(uploadFileArray).then(uploadLocations=>{
            // console.log(uploadLocations);
            sendEmail(uploadLocations);
            res.send("email sent");
        })

    })
});

function retrieveVolume(url){
    return new Promise(function(resolve, reject) {
        // Do async job
        request(url, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                generateCSV(JSON.parse(body)).then(fileName=>{
                    // console.log(fileName);
                    resolve(fileName);
                }).catch(error=>reject(error));

            }
        });
    })

}

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
            {id: 'volume', title: 'Volume(USD)'}
        ]
    });

    const records = [];
    records.push({volume: returnValue.trade_volume_24h_btc});
    for (let record of returnValue.tickers) {
        records.push({base: record.base, target: record.target, volume: record.converted_volume.usd});
    }

    return new Promise(function(resolve, reject) {
        // Do async job
        csvWriter.writeRecords(records)       // returns a promise
            .then(() => {
                console.log('Writing file Done of '+fileName);
                resolve(fileName);
            }).catch(error=>reject(error));
    })


}

function uploadToS3(fileName){
    let s3 = new AWS.S3();

    // call S3 to retrieve upload file to specified bucket
    var uploadParams = {Bucket: 'exchange-retriever', Key: '', Body: '', ACL:"public-read"};

    var fs = require('fs');
    var fileStream = fs.createReadStream('./' + fileName);
    fileStream.on('error', function(err) {
        console.log('File Error', err);
    });
    uploadParams.Body = fileStream;

    var path = require('path');
    uploadParams.Key = path.basename(fileName);
    // uploadParams.body =

    return new Promise(function(resolve, reject) {

        s3.upload(uploadParams, function (err, data) {
            if (err) {
                console.log("Error", err);
                reject(err);
            }
            if (data) {
                resolve(data.Location);
            }
        });
    })

}

function sendEmail(uploadLocations){

    let message='';
    for(let link of uploadLocations){
        message=message+'<p><a href='+link+'>'+link+'</a></p>';
    }

    AWS.config.update({region: 'us-west-2'});

    var params = {
        Destination: { /* required */
            // CcAddresses: [
            //     'EMAIL_ADDRESS',
            //     /* more items */
            // ],
            ToAddresses: [
                'dh.kim91@hotmail.com'
                /* more items */
            ],
            CcAddresses:[
                'sahyun1@hotmail.com'
            ]
        },
        Message: { /* required */
            Body: { /* required */
                Html: {
                    Charset: "UTF-8",
                    Data: message
                },
                // Text: {
                //     Charset: "UTF-8",
                //     Data: "TEXT_FORMAT_BODY"
                // }
            },
            Subject: {
                Charset: 'UTF-8',
                Data: 'Exchange trading volumes'
            }
        },
        Source: 'alstonkim88@gmail.com'
    };

// Create the promise and SES service object
    var sendPromise = new AWS.SES({apiVersion: '2010-12-01'}).sendEmail(params).promise();

// Handle promise's fulfilled/rejected states
    sendPromise.then(
        function(data) {
            console.log(data.MessageId);
        }).catch(
        function(err) {
            console.error(err, err.stack);
        });
}

// function sendEmail(locationArray){
//
//     var params = {
//         Message: location, /* required */
//         TopicArn: 'arn:aws:sns:ap-southeast-2:256368627721:testTpoic'
//         // TopicArn: 'arn:aws:sns:ap-southeast-2:256368627721:exchangeRetriever'
//     };
//     var publishTextPromise = new AWS.SNS().publish(params).promise();
//     publishTextPromise.then(
//         function(data) {
//             console.log(`Message ${params.Message} send sent to the topic ${params.TopicArn}`);
//             console.log("MessageID is " + data.MessageId);
//         }).catch(
//         function(err) {
//             console.error(err, err.stack);
//         });
// }