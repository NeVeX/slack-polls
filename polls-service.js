var fs = require('fs');

var answerStatistics = {};
var allPlayerAnswers = {};
var questions = null;
var currentQuestionInUse = null; // Not in play at the start

var isQuizPaused = false;
var isQuizStopped = true;

loadQuestionsFromFile('config/test.json'); // for testing

function loadQuestionsFromFile(fileName) {
    var questionsJson = fs.readFileSync(fileName);
    var loadResult = doLoadQuestionsFromJson(questionsJson);
    if ( !loadResult || loadResult.isError ) {
        throw Error("Could not load questions from file "+fileName);
    }
}

exports.loadQuestionsFromJson = doLoadQuestionsFromJson;

function validateQuestion(question) {
    var problems = [];
    if ( !question.question ) { problems.push("There is no valid question"); }
    if ( !question.answers || question.answers.length == 0) { problems.push("There are no answers for the poll question") }
    for ( var i = 0; i < question.answers.length; i++) {
        if ( !question.answers[i]) {
            problems.push("Poll answer ["+i+"] does not have any text");
        }
    }
    return problems;
}

function doLoadQuestionsFromJson(questionsJson) {

    if ( !questionsJson ) {
        return { isError: true, message: "Questions JSON is null/empty" };
    }

    try {
        var parsedQuestions = JSON.parse(questionsJson);
        // validate the json
        if ( parsedQuestions && parsedQuestions.length > 0 ) {
            // make sure each one is valid
            var i;
            var errorsFound = [];
            for (i = 0; i < parsedQuestions.length; i++) {
                var q = parsedQuestions[i];
                var problems = validateQuestion(q);
                if ( problems.length > 0 ) {
                    // this is a bad question
                    errorsFound.push("Invalid data for question ["+(i+1)+"] - "+problems.join("; "));
                }
            }
            if ( errorsFound.length == 0 ) {
                questions = parsedQuestions;
                console.log("Successfully loaded a total of ["+questions.length+"] questions");
                return { isError: false }
            } else {
                console.log("Encountered ["+errorsFound.length+"] problems while trying to load questions. ["+errorsFound+"]");
                return { isError: true, errors: errorsFound}
            }
        }
    } catch (e) {
        console.error("Could not load questions from json ["+questionsJson+"] \n "+e);
        return { isError: true, message: "Could not load questions - "+e.message };
    }

}

exports.startPoll = function() {
    answerStatistics = {};
    allPlayerAnswers = {};
    console.log("Started a new poll");
    isQuizPaused = true;
    isQuizStopped = false;
    return true;
};

exports.setCurrentQuestion = function(questionNumber) {
    var question = getQuestion(questionNumber);
    if ( question ) {
        currentQuestionInUse = questionNumber;
        console.log("Changed the poll question in use to ["+currentQuestionInUse+"]");
        return true;
    }
    return false;
};

exports.getStatisticsForQuestion = function(questionNumber) {
    var question = getQuestion(questionNumber);
    if ( ! question ) {
        return { error: "Question number ["+questionNumber+"] is invalid"};
    }
    var statsQuestion = answerStatistics[questionNumber];
    if ( !statsQuestion ) {
        statsQuestion = {}; // default to empty
    }

    var totalAnswers = statsQuestion.totalAnswers ? statsQuestion.totalAnswers : 0;
    var statsToCreate = question.answers.length;
    var answersStats = [statsToCreate];

    for ( var i = 1; i <= statsToCreate; i++) {
        var newStat = {
            "totalVotes": 0,
            "totalVotePercent": 0
        };

        if ( statsQuestion[i] ) {
            newStat.totalVotes = statsQuestion[i] ? statsQuestion[i] : 0;
            if ( totalAnswers > 0 ) {
                newStat.totalVotePercent = Math.round((newStat.totalVotes / totalAnswers) * 100);
            }
        }
        answersStats[i-1] = newStat;
    }

    return {
        "stats": answersStats,
        "totalAnswers": totalAnswers
    }

};

exports.generateTestData = function() {
    var perviousisQuizStopped = isQuizStopped;
    var perviousisQuizPaused = isQuizPaused;

    isQuizStopped = false;
    isQuizPaused = false;
    // TODO: make this waaaay better - actually make it more random and support dynamic question answer sizes!
    var totalQuestions = questions.length;
    var i;
    for (i = 1; i <= 100; i++) {
        var name = "test-name-"+i;
        var q;
        for ( q = 1; q <= totalQuestions; q++) {
            var question = getQuestion(q);
            var answer = Math.floor(Math.random() * question.answers.length) + 1
            recordPlayerAnswerWithGameState(name, answer, q);
        }
    }
    console.log("Successfully generated test data");
    isQuizStopped = perviousisQuizStopped;
    isQuizPaused = perviousisQuizPaused;
    return true;
};

exports.pauseQuiz = function() {
    console.log("Paused the poll at question ["+currentQuestionInUse+"]");
    isQuizPaused = true;
    return true;
};

exports.unPauseQuiz = function() {
    if ( currentQuestionInUse ) {
        console.log("Un-Paused the poll at question ["+currentQuestionInUse+"]");
        isQuizPaused = false;
        return true; // it's unpaused
    }
    console.log("Cannot Un-Paused the poll since question in play is not set");
    return false; // the data isn't correct, so do not un pause
};

exports.stopPoll = function() {
    this.pauseQuiz();
    isQuizStopped = true;
    return isQuizStopped;
};

function getQuestion(number) {
    var questionKey = number - 1;
    if ( questionKey >= 0 && questionKey < questions.length) {
        return questions[questionKey];
    }
    return null;
}

exports.getQuestionForNumber = function(questionNumber) {
    var foundQuestion = getQuestion(questionNumber);
    if ( foundQuestion ) {
        // Don't return the direct question object, create the response we want to send to the client
        return {
            question: foundQuestion.question,
            answers: foundQuestion.answers,
            totalQuestions: questions.length // Add the total questions in this quiz
        };
    }
    return null;
};

exports.recordPlayerAnswer = function(name, answer) {
    return recordPlayerAnswerWithGameState(name, answer, currentQuestionInUse);
};

function recordPlayerAnswerWithGameState(name, answerGiven, questionInPlay) {
    if ( isQuizStopped) {
        return { error: "The poll is over - no more answers can be accepted" }
    }
    if ( isQuizPaused ) {
        return { error: "Poll question "+questionInPlay+" is currently not accepting answers, since the poll is either waiting to start, or has finished already" }
    }
    var currentQuestion = getQuestion(questionInPlay);
    if ( !currentQuestion ) {
        console.log("Could not get the current question: "+questionInPlay);
        return { error: "Could not record score for question "+questionInPlay };
    }


    // console.log("Correct answer: "+correctAnswer+" - given answer "+answer);
    if ( !(name in allPlayerAnswers) ) {
        allPlayerAnswers[name] = {};
    }

    // We only allow one answer per question now
    if ( (questionInPlay in allPlayerAnswers[name]) ) {
        // console.log("Not allowing player to answer again since they already answered");
        return { error: "Looks like you already answered poll question "+questionInPlay+" - I can't let you answer it again"};
    }

    allPlayerAnswers[name][questionInPlay] = 1; // Give them nothing to denote an answer

    if ( answerGiven > 0 && answerGiven <= (currentQuestion.answers.length + 1) ) {
        updateStatistics(questionInPlay, answerGiven);
    }

    return { currentQuestion: questionInPlay};
}

function updateStatistics(currentQuestion, answerGiven) {
    // See if we have already set statistics on this
    if ( !answerStatistics[currentQuestion]) {
        answerStatistics[currentQuestion] = {
            totalAnswers: 0
        }
    }

    if ( ! answerStatistics[currentQuestion][answerGiven] ) {
        answerStatistics[currentQuestion][answerGiven] = 0;
    }
    answerStatistics[currentQuestion][answerGiven]++; // now just increment it
    answerStatistics[currentQuestion].totalAnswers++; // increment the total answers given too
}
