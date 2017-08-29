
var POLL_SLACK_TOKEN = process.env.PROSPER_POLL_SLACK_KEY;
var APPLICATION_SLACK_OAUTH_TOKEN = process.env.SLACK_POLL_APPLICATION_OAUTH_TOKEN;

if (!APPLICATION_SLACK_OAUTH_TOKEN) {
    throw new Error("No application oauth token defined");
}

if (!POLL_SLACK_TOKEN) {
    throw new Error("No application poll key defined");
}

console.log("Will use slack oauth token: "+APPLICATION_SLACK_OAUTH_TOKEN);
console.log("Will use slack interactive token key: "+POLL_SLACK_TOKEN);

var pollsService = require('./polls-service');
var request = require('request');

var slackUserInfo = {};

exports.getPeople = function (request, response) {
    var totalRegistered = getTotalPeopleRegistered();
    return response.status(200).json( { totalRegistered: totalRegistered} );
};

function getTotalPeopleRegistered() {
    var totalRegistered = 0;
    if ( slackUserInfo ) {
        for ( var slackName in slackUserInfo ) {
            if (slackUserInfo.hasOwnProperty(slackName)) {
                // Todo: filter out ppl who "quit"
                totalRegistered++;
            }
        }
    }
    return totalRegistered;
}

exports.slackInteractive = function (request, response) {
    var token = request.body.token;

    var authResponse = checkSlackRequestAuthentication(token, response);
    if ( authResponse ) {
        return;
    }

    var textEntered = request.body.text;
    if ( textEntered ) {
        textEntered = textEntered.trim(); // trim it
    }
    if ( ! textEntered ) {
        // For slack we respond with 200
        return response.status(200).json( { text: "You didn't provide any command text. e.g. '/hackathonpoll join'"} );
    }

    var name = request.body.user_name;
    if ( !name ) {
        return response.status(422).json( { text: "No username provided"} );
    }
    var userId = request.body.user_id;
    if ( !userId) {
        return response.status(422).json( { text: "No userId provided"} );
    }
    var slashCommandChannelId = request.body.channel_id;
    // check the text entered
    if ( textEntered === 'join') {
        console.log("Player ["+name+"] with userId ["+userId+"] has opted to join the poll");
        addSlackUserInfo(name, true, userId, slashCommandChannelId);
        return response.status(200).json( { text: "Hurrah! You've registered. Note, all further interaction will be done in the slackbot channel, so go there!"} );
    } else if ( textEntered === 'stop') {
        console.log("Player ["+name+"] has opted to stop playing in the poll");
        removeSlackUserFromPoll(name);
        return response.status(200).json( { text: "You got it! I won't annoy you anymore with the poll"} );
    }
    else {
        addSlackNonInteractiveUserIfNotFound(name, userId, slashCommandChannelId);
        // We'll just treat this like they are answering normally (i.e. /quiz 2)
        var response = recordSlackAnswer(name, textEntered, response);

        deleteAnySlackMessagesForUser(name);

        return response;
    }
};

function deleteAnySlackMessagesForUser(name) {
    if ( ! name) { return; }
    console.log("Will delete all know slack messages for user ["+name+"]");
    if ( slackUserInfo.hasOwnProperty(name)) {
        var slackUser = slackUserInfo[name];
        if ( slackUser.messagesToDelete && slackUser.messagesToDelete.length > 0 ) {
            // delete all of them
            for ( var i = 0; i < slackUser.messagesToDelete.length; i++) {
                var messageInfo = slackUser.messagesToDelete[i];
                if ( !messageInfo ) { continue; }
                deleteSlackChatMessage(messageInfo.channelId, messageInfo.ts);
            }
        }
    }
}

exports.sendNewQuestionToSlackUsers = function (questionInformation) {
    console.log("Sending new question to slack users");

    var answersText = [];
    var availableActions = [];

    for ( var i = 0; i < questionInformation.answers.length; i++) {
        var pollAnswerNumber = i + 1;
        answersText.push(pollAnswerNumber+". "+questionInformation.answers[i] + "\n");
        availableActions.push(
            {
                name: "answer",
                text: "Answer "+pollAnswerNumber,
                type: "button",
                value: ""+pollAnswerNumber
            }
        );
    }

    // NOTE! There's a maximum of 5 actions per message (limit of slack)
    var actionsToSend = [];
    var rawAnswerText = "";
    var alreadySentQuestionPart = false;
    var questionsBuiltUp = 0;
    var intervalWaitMs = 0;
    var intervalWaitGapMs = 1200;
    for ( var k = 0; k < answersText.length; k++) {
        actionsToSend.push(availableActions[k]);
        rawAnswerText += answersText[k];
        questionsBuiltUp++;

        if ( questionsBuiltUp % 5 == 0 || k == answersText.length-1)  {
            var questionPrefix = "";
            if ( alreadySentQuestionPart ) {
                questionPrefix = " [CONTINUED] ";
                intervalWaitMs += intervalWaitGapMs;
            }
            console.log("Will send all slack questions using ["+intervalWaitMs+"] wait time ms for questions index ["+questionsBuiltUp+"]");
            // send what we have
            setTimeout(function (questionPrefix, rawAnswerText, actionsToSend) {
                sendInteractiveQuestionToAllSlackUsers(questionPrefix + questionInformation.question, rawAnswerText, actionsToSend);
            }, intervalWaitMs, questionPrefix, rawAnswerText, actionsToSend);

            rawAnswerText = ""; // default back
            actionsToSend = []; // default back
            alreadySentQuestionPart = true;
        }
    }

};

function sendInteractiveQuestionToAllSlackUsers(slackQuestion, answersRawText, actions) {
    // console.log("Will send all answers to slack users now for question ["+slackQuestion+"]");
    // for each player that is still active and playing - send the question
    var slackAttachments = [ {
        text: answersRawText,
        fallback: "Something went wrong",
        callback_id: "slack",
        color: "#0d1b52",
        attachment_type: "default",
        actions: actions
    }];

    for ( var slackName in slackUserInfo ) {
        if (slackUserInfo.hasOwnProperty(slackName)) {
            // Get the url to post to
            var slackUser = slackUserInfo[slackName];
            var personalChannelId = slackUser.personalChannelId;
            var wantsToPlayInteractively = slackUser.wantsToPlayInteractively;
            if ( !personalChannelId || !wantsToPlayInteractively ) {
                continue; // don't annoy this person
            }

            sendInteractiveMessageToSlack(slackUser, slackQuestion, slackAttachments);
        }
    }
}

function checkSlackRequestAuthentication(token, response) {
    if ( token && token == POLL_SLACK_TOKEN ) {
        return null; // all good
    } else {
        console.log("Provided slack message token is not correct: ["+token+"] != ["+POLL_SLACK_TOKEN+"]");
        return response.status(403).json({});
    }
}

function recordSlackAnswer(name, answer, response) {

    if ( !name ) {
        return response.status(422).json({ "error": "No name provided"});
    }
    if ( answer ) {
        answer = answer.trim();
    }
    if ( !answer || !isNumber(answer)) {
        // 200 for slack
        return response.status(200).json({"text": "Looks like you provided an invalid poll answer number, try again with a valid number"});
    }

    deleteAnySlackMessagesForUser(name);

    var scoreResult = pollsService.recordPlayerAnswer(name, answer);
    if ( scoreResult && !scoreResult.error ) {
        return response.status(200).json({"text": "Cool, got your answer to poll question "+scoreResult.currentQuestion});
    } else {
        if ( scoreResult.error) {
            // needs to be a 200 for slack response
            return response.status(200).json({"text": scoreResult.error});
        } else {
            return response.status(500).json({"text": "Could not save answer"});
        }
    }
}

function addSlackNonInteractiveUserIfNotFound(name, userId, slashCommandChannelId) {
    if ( !(name in slackUserInfo) ) {
        // we don't have this user - so let's add him
        addSlackUserInfo(name, false, userId, slashCommandChannelId); // set interactivity to false
    }
}

function addSlackUserInfo(name, wantsToPlayInteractively, userId, slashCommandChannelId) {
    if ( !(name in slackUserInfo) ) {
        slackUserInfo[name] = {};
    }
    var playerInfo = {};
    playerInfo.wantsToPlayInteractively = wantsToPlayInteractively;
    playerInfo.userId = userId;
    playerInfo.slashCommandChannelId = slashCommandChannelId;
    playerInfo.slackPersonalChannelName = "@"+name;
    slackUserInfo[name] = playerInfo;

    // setProfileInfoForUser(playerInfo);
    setPersonalChannelIdForUser(playerInfo);
}

function removeSlackUserFromPoll(name) {
    if (slackUserInfo.hasOwnProperty(name)) {
        var userInfo = slackUserInfo[name];
        userInfo.personalChannelId = null;
        userInfo.slashCommandChannelId = null;
        userInfo.wantsToPlayInteractively = false;
    }
}

function unregisterAllSlackUsersFromPoll() {
    console.log("Un registering all slack user information");
    for ( var slackName in slackUserInfo ) {
        if (slackUserInfo.hasOwnProperty(slackName)) {
            var userInfo = slackUserInfo[slackName];
            userInfo.wantsToPlayInteractively = false;
        }
    }
}

function setPersonalChannelIdForUser(playerInfo) {
    console.log("Getting personal IM channel for player user id ["+playerInfo.userId+"]");
    // We need to open an IM to the user and get the channel info to participate in the quiz
    request.post({
        url:'https://slack.com/api/im.open',
        form: {
            token: APPLICATION_SLACK_OAUTH_TOKEN,
            return_im: false,
            user: playerInfo.userId
        }},
        function( error, httpResponse, body) {
            if (error) {
                console.log("There was an error trying to get the personal channel id for user Id ["+playerInfo.userId+"]: "+JSON.stringify(error));
            } else {
                if ( body ) {
                    var parsedBody = JSON.parse(body);
                    if ( parsedBody && parsedBody.channel && parsedBody.channel.id) {
                        playerInfo.personalChannelId = parsedBody.channel.id;
                        // var personalChannelSameAsSlashChannel = playerInfo.slashCommandChannelId && playerInfo.slashCommandChannelId === playerInfo.personalChannelId;
                        // if ( !personalChannelSameAsSlashChannel && playerInfo.personalChannelId && playerInfo.wantsToPlayInteractively ) {
                            // Only send a message to the person if the slash command channel is different to the personal channel
                        if ( playerInfo.slackPersonalChannelName && playerInfo.wantsToPlayInteractively ) {
                            // var name = playerInfo.firstName ? playerInfo.firstName : playerInfo.slackPersonalChannelName;
                            var message = "Oh hai there! I'll post all the poll questions for you here in this channel.";
                            sendSimpleSlackMessageToChannel(playerInfo.slackPersonalChannelName, message);
                        }
                    }
                }
            }
        }
    );
}

exports.slackInteractiveAnswer = function (request, response) {
    /**
     * Slack gives the request body as a single x-www-url-encoded key called "payload" that contains
     * JSON that's also encoded - so it's a bit fucked
     * So here I just rely on JSON library to parse and handle the encoding (escaping) madness
     */
    var stringifyBody = JSON.stringify(request.body);
    var parsedJson = JSON.parse(stringifyBody);
    var data = JSON.parse(parsedJson.payload);

    var token = data.token;
    var authResponse = checkSlackRequestAuthentication(token, response);
    if ( authResponse ) {
        return;
    }

    var name = data.user.name;
    var answerNumber = data.actions[0].value;
    return recordSlackAnswer(name, answerNumber, response);

};

exports.pollHasStarted = function () {
    var message = "The poll has now started! I'll send you the questions as they come! :-)";
    sendSimpleSlackMessageToAllUsers(message, false);
};

exports.pollHasStopped = function() {
    console.log("The poll is over - so sending a goodbye to everyone that participated");
    var message = "The poll is now over! Thanks for participating - I hope you had fun! (I've also un-registered you, so I won't annoy you anymore)";
    sendSimpleSlackMessageToAllUsers(message, true);
    unregisterAllSlackUsersFromPoll();
};

function sendSimpleSlackMessageToAllUsers(message, shouldRemoveUsersAfterSending) {
    if ( !slackUserInfo ) {
        return; // nothing to do
    }
    // don't send any more updates to people
    for ( var slackName in slackUserInfo ) {
        if (slackUserInfo.hasOwnProperty(slackName)) {
            // Get the url to post to
            var personalChannelId = slackUserInfo[slackName].personalChannelId;
            var wantsToPlayInteractively = slackUserInfo[slackName].wantsToPlayInteractively;
            if ( !personalChannelId || !wantsToPlayInteractively ) {
                continue; // they do not want to be bothered, so skip this person
            }

            sendSimpleSlackMessageToChannel(slackUserInfo[slackName].slackPersonalChannelName, message);

            if ( shouldRemoveUsersAfterSending ) {
                // This is the last message we should send to this person
                slackUserInfo[slackName].wantsToPlayInteractively = false;
                slackUserInfo[slackName].personalChannelId = null;
            }
        }
    }
}

function sendSimpleSlackMessageToChannel(channelId, message) {
    sendMessageToSlack(channelId, message, null, null);
}

function sendInteractiveMessageToSlack(slackUser, message, attachments) {
    sendMessageToSlack(slackUser.slackPersonalChannelName, message, attachments, function (slackResponse) {
        // on response - save the message info to delete it later
        if ( ! slackUser.messagesToDelete ) {
            slackUser.messagesToDelete = [];
        }
        slackUser.messagesToDelete.push( { channelId: slackResponse.channel, ts: slackResponse.ts })
    })
}

function sendMessageToSlack(channelId, message, attachments, onResponse) {

    var postForm = {
        token: APPLICATION_SLACK_OAUTH_TOKEN,
        channel: channelId,
        text: message,
        as_user: false
    };

    if ( attachments ) {
        postForm.attachments = JSON.stringify(attachments);
    }

    request.post({
            url:'https://slack.com/api/chat.postMessage',
            form: postForm
        },
        function( error, httpResponse, body) {
            if (error) {
                console.log("There was an error sending the message ["+message+"] to channel id ["+channelId+"] postMessage "+JSON.stringify(error));
            }
            if ( body && onResponse ) {
                var response = JSON.parse(body); // channel, ts,
                onResponse(response);
            }
        }
    );
}

function deleteSlackChatMessage(channelId, ts) {
    var postForm = {
        token: APPLICATION_SLACK_OAUTH_TOKEN,
        channel: channelId,
        ts: ts,
        as_user: false
    };

    request.post({
            url:'https://slack.com/api/chat.delete',
            form: postForm
        },
        function( error, httpResponse, body) {
            if (error) {
                console.log("There was an error deleting the message for channel id ["+channelId+"] with ts ["+ts+"]");
            }
        }
    );

}

function isNumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}
