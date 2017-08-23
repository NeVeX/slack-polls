var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('poll',
      {
        title: 'Slack Poll',
        pollQuestion: 'This is the question from the server'
      });
});

module.exports = router;
