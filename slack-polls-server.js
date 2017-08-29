'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');
var fs = require('fs');
var app = express();
var pollControl = require('./poll-control');
var slackApi = require('./slack-api');
var pollsApi = require('./polls-api');
var testApi = require('./test-api');

var landingPageHtml = fs.readFileSync('static/landing-page.html');
var pollHtml = fs.readFileSync('static/poll.html');

app.use(bodyParser.urlencoded( { extended: false}));
app.use(bodyParser.json());
app.use('/slackpolls', express.static(path.join(__dirname, 'static'))); // get references to the html's

app.use(function(request, response, next) {
    request.nevex = {};
    // Set a simple boolean to indicate if this request is from the quiz master
    request.nevex.isPollMaster = pollControl.isPollMasterKeyCorrect(request);
    next();
});

app.post('/slackpolls/slack', slackApi.slackInteractive);
app.post('/slackpolls/slack/interactive', slackApi.slackInteractiveAnswer);
app.post('/slackpolls/test/data', testApi.generateTestData);
app.get('/slackpolls/questions', pollControl.getQuestionForNumber);
app.post('/slackpolls/questions', pollsApi.setQuestions);
app.get('/slackpolls/stats', pollControl.getStatisticsForQuestion);
app.post('/slackpolls/slack/sendquestion', pollControl.sendQuestionToSlack);

app.post('/slackpolls/start', pollControl.startPoll);
app.post('/slackpolls/stop', pollControl.stopPoll);
app.post('/slackpolls/pause', pollsApi.pauseQuiz);
app.post('/slackpolls/unpause', pollsApi.unPauseQuiz);

app.get('/slackpolls/people', slackApi.getPeople);

app.get('/slackpolls', function(request, response) {
    response.setHeader('Content-Type', 'text/html');
    return response.status(200).end(landingPageHtml);
});

app.get('/slackpolls/start', function(request, response) {
    response.setHeader('Content-Type', 'text/html');
    return response.status(200).end(pollHtml);
});

module.exports = app;
var portNumber = 34355;
app.listen(portNumber);
console.log('Server started and listening on port ['+portNumber+']...');
