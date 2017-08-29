$( document ).ready(function() {
    init();
});

var QUIZ_MASTER_INPUT_ID = "#quiz-master-key";
var QUIZ_START_BUTTON_ID = "#start-quiz-button";
var QUIZ_MASTER_KEY_LOCAL_ID = "quiz-master-key";

function init() {
    console.log("Landing page js loaded");
    deleteQuizMasterKeyFromLocal();
    setupQuizMasterKeyControl();
    setupStartQuizControl();
}

function setupStartQuizControl() {

    $(QUIZ_START_BUTTON_ID).click(function(e) {
        window.location.replace("start");
    });
}

function setupQuizMasterKeyControl() {
    // listen on the quiz master key
    $(QUIZ_MASTER_INPUT_ID).keypress(function(e) {
        if(e.which == 13) {
            var quizMasterKey = e.currentTarget.value;
            if ( quizMasterKey ) {

                // Check if we have a good key - check question one if we get an answer
                // A 200 means we are good - this is totally a security flaw - but it's a freaking quiz
                $.ajax({
                    type: "GET",
                    headers: { "Poll-Key": quizMasterKey},
                    url: "stats?number="+1,
                    success: function(data) {
                        // Save the key into local storage
                        saveQuizMasterKeyToLocal(quizMasterKey);
                        $(QUIZ_MASTER_INPUT_ID).attr("class", "nevex-password-ok");
                        $(QUIZ_START_BUTTON_ID).attr("class", "nevex-button");
                    },
                    error: function(error) {
                        deleteQuizMasterKeyFromLocal();
                        $(QUIZ_MASTER_INPUT_ID).attr("class", "nevex-password-not-ok");
                        $(QUIZ_START_BUTTON_ID).attr("class", "nevex-button-hide");
                    }
                });
            }
        }
    });
}

function saveQuizMasterKeyToLocal(quizMasterKey) {
    localStorage.setItem(QUIZ_MASTER_KEY_LOCAL_ID, quizMasterKey);
}

function deleteQuizMasterKeyFromLocal() {
    localStorage.removeItem(QUIZ_MASTER_KEY_LOCAL_ID);
}