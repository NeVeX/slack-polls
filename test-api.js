
var pollsService = require('./polls-service');

exports.generateTestData = function (request, response) {
    console.log("New POST request received to /prosperpoll/test/data");
    if ( request.nevex.isPollMaster ) {
        var didGenerateData = pollsService.generateTestData();
        return response.status(200).json({"didGenerateData": didGenerateData});
    } else {
        return response.status(403).json({"error": "You are not authorized to generate test data"});
    }
};
