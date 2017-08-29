var POLL_MASTER_KEY = process.env.POLL_MASTER_KEY;


if ( !POLL_MASTER_KEY) {
    throw new Error("No poll master key defined");
}

console.log("Will use poll master key: "+POLL_MASTER_KEY);

var POLL_KEY_HEADER = "Poll-Key";

var pollsApi = require('./polls-api');
var slackApi = require('./slack-api');

exports.isPollMasterKeyCorrect = function(request) {
   return checkIsPollMasterKeyCorrect(request);
};

exports.getQuestionForNumber = function (request, response) {

    var questionNumber = request.query.number;
    if ( questionNumber ) {
        var questionInformation = pollsApi.getQuestionForNumber(request, questionNumber);
        if ( questionInformation.error ) {
            return response.status(422).json({error: questionInformation.error});
        }
        return response.status(200).json(questionInformation);
    } else {
        return response.status(422).json({"error": "You must provide a question number"});
    }
};

exports.startPoll = function (request, response) {

    var pollStarted = pollsApi.startPoll(request);
    if ( pollStarted ) {
        slackApi.pollHasStarted();
    }
    response.status(200).json( { isStarted: pollStarted } );

};

exports.stopPoll = function (request, response) {

    var stopResponse = pollsApi.stopPoll(request);
    if ( stopResponse.error ) {
        return response.status(422).json(stopResponse);
    }

    var isStoppedStatus = stopResponse.isStopped;
    if ( isStoppedStatus ) {
        slackApi.pollHasStopped();
    }
    return response.status(200).json( {isStopped: isStoppedStatus} );

};

exports.sendQuestionToSlack = function (request, response) {
    var questionNumber = request.body.number;
    if ( questionNumber ) {
        var fullQuestion = pollsApi.getQuestionForNumber(request, questionNumber);
        if ( fullQuestion ) {
            console.log("Sending poll question ["+questionNumber+"] to all slack users");
            slackApi.sendNewQuestionToSlackUsers(fullQuestion);
            return response.status(200).json( { message: "success" } );
        }
        return response.status(403).json( { error: "Could not find question ["+questionNumber+"]"} );
    }
    return response.status(403).json( { error: "No question number provided"} );
};

exports.getStatisticsForQuestion = function (request, response) {
    if ( request.nevex.isPollMaster ) {
        var questionNumber = request.query.number;
        if ( questionNumber) {
            var stats = pollsApi.getStatisticsForQuestion(questionNumber);
            return response.status(200).json(stats);
        } else {
            return response.status(422).json( {"error": "You must provide a poll question number"} );
        }
    } else {
        return response.status(403).json({"error": "You are not authorized to view the statistics"});
    }
};

function checkIsPollMasterKeyCorrect(request) {
    var pollMasterKey = request.get(POLL_KEY_HEADER);
    return pollMasterKey && POLL_MASTER_KEY === pollMasterKey;
}
