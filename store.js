'use strict'

const http = require("./config")

class store {
    getReviewsParsed () {
        return http.get("reviews_parsed_all")    
    }

    postReviewsParsed (data) {
        return http.post("/reviews_parsed", data)
    }

    getPartners(){
        return http.get("/partners")
    }
}

module.exports = store