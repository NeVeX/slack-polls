
var pollsService = require('./polls-service');

exports.getQuestionForNumber = function (request, questionNumber) {

    var questionToReturn = pollsService.getQuestionForNumber(questionNumber);
    if ( questionToReturn) {
        questionToReturn.didQuestionChange = false;
        if ( request.nevex.isPollMaster ) {
            // Change the question in play
            questionToReturn.didQuestionChange = pollsService.setCurrentQuestion(questionNumber);
        }
        return questionToReturn;
    } else {
        return { error: "Could not find question "+questionNumber};
    }
};

exports.setQuestions = function (request, response) {

    if ( request.nevex.isPollMaster  ) {
       var result = pollsService.loadQuestionsFromJson(JSON.stringify(request.body));
       if ( !result || result.isError ) {
           return response.status(422).json(result);
       } else {
           return response.status(201).json({"message": "Successfully updated the questions"})
       }
    } else {
        return response.status(403).json({"error": "You are not allowed to set the questions"});
    }
};

exports.startPoll = function (request) {
    if ( request.nevex.isPollMaster ) {
        return pollsService.startPoll();
    }
    return false; // not authorized
};

exports.stopPoll = function (request) {
    if ( request.nevex.isPollMaster ) {
        return { isStopped: pollsService.stopPoll() }
    } else {
        return { error: "You are not authorized to stop the quiz"};
    }
};

exports.pauseQuiz = function (request, response) {
    if ( request.nevex.isPollMaster ) {
        var isPaused = pollsService.pauseQuiz();
        return response.status(200).json({"isPaused": isPaused});
    } else {
        return response.status(403).json({"error": "You are not authorized to pause the quiz"});
    }
};

exports.unPauseQuiz = function (request, response) {
    if ( request.nevex.isPollMaster ) {
        var isPaused = pollsService.unPauseQuiz();
        return response.status(200).json({"isUnPaused": isPaused});
    } else {
        return response.status(403).json({"error": "You are not authorized to un-pause the quiz"});
    }
};

exports.getStatisticsForQuestion = function (questionNumber) {
    return pollsService.getStatisticsForQuestion(questionNumber);
};