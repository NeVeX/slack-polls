$( document ).ready(function() {
    init();
});

var ANSWER_WRONG_CLASS_NAME = "answer-wrong";
var ANSWER_RIGHT_CLASS_NAME = "answer-right";

var POLL_CONTROL_BUTTON = "#poll-control-button";
var NEXT_POLL_BUTTON = "#next-poll-control-button";
var POLL_ANSWER_GRID_DIV = "#poll-answer-grid-div";
var POLL_TOTAL_REGISTERED = "#poll-answers-update-total-registered";
var POLL_CURRENT_PARTICIPATED = "#poll-answers-update-current-participation";

var quizMasterKey;
var isMoreQuestions = false;
var showingOpenPollText = true;
var haveAlreadySentSlackQuestions = false;
var currentQuestionInUse;

function setOpenPollButton() {
    $(POLL_CONTROL_BUTTON).text("Open Poll");
    $(POLL_CONTROL_BUTTON).removeAttr('class');
    $(POLL_CONTROL_BUTTON).addClass("btn btn-primary");
    showingOpenPollText = true;
}

function setClosePollButton() {
    $(POLL_CONTROL_BUTTON).text("Close Poll");
    $(POLL_CONTROL_BUTTON).removeAttr('class');
    $(POLL_CONTROL_BUTTON).addClass("btn btn-danger");
    showingOpenPollText = false;
}

function hideNextPollButton() {
    $(NEXT_POLL_BUTTON).fadeTo(0, 0);
}

function showNextPollButton() {
    $(NEXT_POLL_BUTTON).fadeTo(0, 1);
}

function init() {
    hideNextPollButton();
    console.log("poll.js activated" );
    quizMasterKey = localStorage.getItem("quiz-master-key"); // may or may not be set

    var startQuestion = 1;
    var queryStartOverride = getParameterByName("start");
    if ( queryStartOverride ) {
        startQuestion = parseInt(queryStartOverride);
    }
    console.log("Starting poll from question "+startQuestion);
    if ( startQuestion === 1) {
        startNewQuiz(); // only start new quiz on question 1
    }
    getQuestion(startQuestion);

    $(POLL_CONTROL_BUTTON).click(function () {
        console.log("Poll control button clicked");
        if ( showingOpenPollText ) {
            setClosePollButton();
            if ( ! haveAlreadySentSlackQuestions) {
                unPauseTheQuiz();
                sendQuestionToSlackUsers(currentQuestionInUse, function () {
                    console.log("Slack users have been notified of question ["+currentQuestionInUse+"]");
                });
                haveAlreadySentSlackQuestions = true;
            }
        } else {
            pauseQuiz();
            setOpenPollButton();
            getStatsForQuestion(currentQuestionInUse, function (stats) {
                showStats(stats);
            });
        }
    });

    $(NEXT_POLL_BUTTON).click(function () {
        console.log("Next Poll button clicked");
        currentQuestionInUse++;
        haveAlreadySentSlackQuestions = false;
        getQuestion(currentQuestionInUse);
    });

    setupPollingForUsers();

}


function setupPollingForUsers() {
    setInterval(function () {
        getStatsForQuestion(currentQuestionInUse, function (statsData) {
            if ( statsData ) {
                var totalCurrentAnswers = statsData.totalAnswers;
                $(POLL_CURRENT_PARTICIPATED).text(totalCurrentAnswers);
            }
        });
        
        getUserInformation(function (userInfo) {
            if ( userInfo ) {
                var totalRegistered = userInfo.totalRegistered;
                $(POLL_TOTAL_REGISTERED).text(totalRegistered);
            }
        });

    }, 200);
}

function getUserInformation(onSuccess) {
    $.ajax({
        type: "GET",
        headers: { "Poll-Key" : quizMasterKey},
        url: "people",
        success: function(data) {
            onSuccess(data);
        },
        error: function(error) {
            console.log("Could not get user information");
        }
    })
}

function startNewQuiz() {
    console.log("Starting a new poll");
    $.ajax({
        type: "POST",
        headers: { "Poll-Key" : quizMasterKey},
        url: "start",
        success: function(data) {
            console.log("Poll started. Got response: "+JSON.stringify(data));
        },
        error: function(error) {
            if ( quizMasterKey ) {
                onError(error); // only error on when we are the quiz master
            }
        }
    })
}

function getQuestion(questionNumber) {
    console.log("Getting question "+questionNumber);
    $.ajax({
		type: "GET",
        headers: { "Poll-Key" : quizMasterKey},
		url: "questions?number="+questionNumber,
		success: function(data) {
            onPollQuestionDataReturned(questionNumber, data);
		},
		error: function(error) {
            onError(error);
        }
	})	
}

function onPollQuestionDataReturned(questionNumber, data) {

    // resetAllAnswersForNewQuestion();
    currentQuestionInUse = questionNumber;
    console.log("Got data back from poll api: "+data);
    // show the question for a moment
    $("#question-text").html(data.question);
    var answerDiv = $(POLL_ANSWER_GRID_DIV);

    answerDiv.empty();

    for ( var i = 0; i < data.answers.length; i++) {
        var answerText = data.answers[i];
        answerDiv.append(
            '<div class="poll-answer-box" id="poll-answer-box-'+i+'">'+
                '<div class="poll-answer-box-answer" id="poll-answer-'+i+'">'+(i+1)+'.  '+answerText+'</div>'+
                '<div class="poll-answer-box-result" id="poll-result-'+i+'"></div>'+
            '</div>'
        );
    }

    isMoreQuestions = questionNumber < data.totalQuestions;

    if ( !isMoreQuestions) {
        hideNextPollButton();
    } else {
        showNextPollButton();
    }
    setOpenPollButton();
}

function sendQuestionToSlackUsers(questionNumber, onSuccessFunction) {
    console.log("Sending new question ["+questionNumber+"] to slack users");

    $.ajax({
        type: "POST",
        url: "slack/sendquestion",
        headers: { "Content-Type": "application/json", "Poll-Key" : quizMasterKey },
        data: JSON.stringify( { number: questionNumber } ),
        success: function(data) {
            console.log("Response to sending question ["+questionNumber+"] to slack: "+JSON.stringify(data));
            onSuccessFunction();
        },
        error: function(error) {
            if ( quizMasterKey ) {
                onError("Could not send question to slack users");
            } else {
                console.log("Error response occurred when sending question to slack users, but we don't care");
            }
        }
    });
}

function getStatsForQuestion(currentQuestion, onSuccess, onFailure) {
    $.ajax({
        type: "GET",
        headers: { "Poll-Key" : quizMasterKey },
        url: "stats?number="+currentQuestion,
        success: function(data) {
            onSuccess(data);
        },
        error: function(error) {
            onFailure(error);
        }
    });
}

function showStats(data) {

    if ( data && data.stats.length > 0 ) {

        var allElementsData = [];
        var highestVotePercent = 0;

        for ( var i = 0; i < data.stats.length; i++) {
            var pollResultDiv = $("#poll-answer-box-"+i);
            var pollResultElement = $("#poll-result-"+i);
            if ( ! pollResultElement || ! pollResultDiv) {
                continue;
            }
            var votePercent = data.stats[i].totalVotePercent;
            pollResultElement.text(votePercent+"%");
            if ( votePercent >= highestVotePercent) {
                highestVotePercent = votePercent; // change the highest vote now
                allElementsData.push({votePercent: votePercent, element: pollResultDiv});
            }
        }

        for ( var k = 0; k < allElementsData.length; k++) {
            var elementData = allElementsData[k];
            if ( elementData.votePercent >= highestVotePercent) {
                setPollAnswerAsWinner(elementData.element);
            }
        }

    }

}

function setPollAnswerAsWinner(element) {
    removeAllRightWrongClassesFromElement(element);
    element.addClass(ANSWER_RIGHT_CLASS_NAME);
}

function removeAllRightWrongClassesFromElement(element) {
    element.removeClass(ANSWER_WRONG_CLASS_NAME);
    element.removeClass(ANSWER_RIGHT_CLASS_NAME);
}

function pauseQuiz() {
    $.ajax({
        type: "POST",
        url: "pause",
        headers: { "Content-Type": "application/json", "Poll-Key" : quizMasterKey },
        success: function(data) {
            console.log("Response to pausing quiz: "+JSON.stringify(data));
        },
        error: function(error) {
            if ( quizMasterKey ) {
                onError("Could not pause quiz");
            } else {
                console.log("Error response occurred to pausing quiz, but we don't care");
            }
        }
    });
}

function unPauseTheQuiz() {
    $.ajax({
        type: "POST",
        url: "unpause",
        headers: { "Content-Type": "application/json", "Poll-Key" : quizMasterKey },
        success: function(data) {
            console.log("Response to un-pausing quiz: "+JSON.stringify(data));
        },
        error: function(error) {
            if ( quizMasterKey ) {
                onError("Could not un-pause quiz");
            } else {
                console.log("Error response occurred to un-pausing quiz, but we don't care");
            }
        }
    });
}


function getParameterByName(sParam) {
    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : sParameterName[1];
        }
    }
}

function onError(error) {
    console.log("Error occurred: "+error);
    alert("An error occurred! Lol!");
}