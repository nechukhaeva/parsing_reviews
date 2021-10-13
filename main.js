'use strict'

const Store = require('./store')
const puppeteer = require('puppeteer')
const readline = require('readline')

const store = new Store()

//urlRequestByConsole()
//urlRequestByDB()

function urlRequestByDB(){
    store.getPartners().then(response => {
        (async () => {
        if (response.data.success){
            var partners = response.data.partners
            for (let partner of partners){
                let settings = JSON.parse(partner.settings)
                let review_trip = settings.review_trip.split(" , ") 
                let review_2gis = settings.review_2gis.split(" , ")
                let review_yandex = settings.review_yandex.split(" , ")
                let review_google = settings.review_google.split(" , ")
                let review_vlru = settings.review_vlru.split(" , ")
                
                for (let otz of [review_trip, review_2gis, review_yandex, review_google, review_vlru]){
                    for (let url of otz){
                        if (url != ""){
                            console.log(url, partner.name)
                            await callParsing(url, partner.name)
                        }
                    }
                }
                
            }
        } 
        })()
        
    }).catch(e => {
        console.log(e)
    })
    console.log('Done!')
    setTimeout(urlRequestByDB, 7200000) //7 200 000 - 2 часа
}

async function urlRequestByConsole() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    })
    const question = (str) => new Promise(resolve => rl.question(str, resolve)) 
    async function getUrl () {
        let url = await question('Введите url: ')
        return url
    }
    async function  getCompany () {
        let company = await question('Введите название компании: ') 
        return company
    }

    var url = await getUrl()
    var company = await getCompany()

    callParsing(url, company)
    setTimeout(urlRequestByConsole, 60000) //7 200 000 - 2 часа
}

async function callParsing(url, company){
    if (url.includes('www.google.com')) {await parsingGoogle(url, company)}
    if (url.includes('2gis.ru')) {await parsing2gis(url, company)}
    if (url.includes('www.tripadvisor.ru')) {await parsingTripadvisor(url, company)}
    if (url.includes('yandex.ru')) {await parsingYandex(url, company)}
    if (url.includes('www.vl.ru')) {await parsingVlru(url, company)}
}

//VL RU
async function parsingVlru(url, company) {
    const browser = await puppeteer.launch({ 
        headless: true, 
        defaultViewport: null,
    }) 
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2' })
    try{
        await page.waitForSelector('main') 

        const result = await page.evaluate((company) => { 

            function getMonth(date){
                let month = ['январ', 'феврал', 'март', 'апрел', 'ма', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр']
                for (let i=0; i<12; i++){
                    if (date.includes(month[i])) return ((i+1) < 10 ? '0'+(i+1) : (i+1))
                }
                return ''
            }
             
            let totalSearchResults = document.querySelectorAll('li[data-type="review"]')
            let comments = []

            for (let commentElement of totalSearchResults) {
                let photoUser = commentElement.querySelector('div.user-avatar img') ? commentElement.querySelector('div.user-avatar img').getAttribute('src') : ''
                let nameUser = commentElement.querySelector('div.cmt-user-name span') ? commentElement.querySelector('div.cmt-user-name span').innerHTML : ''
                let date = commentElement.querySelector('span.time').innerHTML
                if (date.includes('назад')) { //проверить возможно у них не только с часами, а с днями, тогда сделать по-другому
                    date = new Date()
                    date = date.getFullYear()+'-'+(date.getMonth()+1)+'-'+date.getDate()
                } else{
                    date = date.substring(date.length - 7, date.length - 3)+'-'+ getMonth(date) + '-'+ (Number(date.slice(0, 2))<10 ? '0'+Number(date.slice(0, 2)) : Number(date.slice(0, 2)))
                }
                let rating = commentElement.querySelector('div.star-rating div.active') ? (commentElement.querySelector('div.star-rating div.active').getAttribute('data-value') / "0.2") : 0
                let blockquote = commentElement.querySelector('blockquote')
                let textReview = blockquote.innerText
                let photos, photosReview = []
                if (blockquote.querySelector('div.comment-images') === null) {photos = ''} else {
                    photos = blockquote.querySelectorAll('div.comment-images div.item a')
                    for (let photo of photos) {
                        if (photo) photosReview.push(photo.getAttribute('href'))
                    }
                }

                let comment = {
                    company: company,
                    date: date,
                    rating: Math.round(rating),
                    textReview: textReview,
                    nameUser: nameUser, 
                    photoUser: photoUser, 
                    photosReview: String(photosReview),
                    site: "vlru",
                    companyResponses: null
                }
                if (textReview != '') comments = comments.concat(comment)
            }

            let companyResponses = document.querySelectorAll('div.comment.answer')
            for (let response of companyResponses){
                if (response) {
                    let line = ''
                    let name = response.querySelector('div.line span.user-name') ? response.querySelector('div.line span.user-name').innerText : ''
                    if (response.querySelector('div.line span.user-name.owner') || name === "Директор кафе") {
                        line += name + " \n "
                        line += response.querySelector('div.line span.time') ? (response.querySelector('div.line span.time').innerText + " \n ") : ''
                        line += response.querySelector('div.comment-body p.comment-text') ? (response.querySelector('div.comment-body p.comment-text').innerText) : ''
                    }
                    for (let i = comments.length - 1; i >= 0; --i){
                        let name = response.querySelector('div.cmt-show-parent') ? response.querySelector('div.cmt-show-parent').innerText.replace('ответ на комментарий ', '') : ''
                        if (comments[i].nameUser === name) {
                            comments[i].companyResponses = line
                            break
                        }
                    }
                } 
            }
            return comments
        }, company) 
        sendReviews(result)
    } catch(e){console.log(e)}
    page.close()
}

//ЯНДЕКС  
async function parsingYandex(url, company) {
    const browser = await puppeteer.launch({ 
        headless: true, 
        defaultViewport: null,
    })
    const page = await browser.newPage()

    await page.goto(url, { waitUntil: 'domcontentloaded' })
    try{
        await page.waitForSelector('body') 
        await page.evaluate(() => {
            if (document.querySelector('.close-button._color_black._circle._offset_large')) document.querySelector('.close-button._color_black._circle._offset_large').click()
            if (Array.from(document.querySelectorAll('.business-review-view__info')).length === 0){
                document.querySelector('.tabs-select-view__title._name_reviews').click()
            }
        }) 
        await new Promise(r => setTimeout(r, 2000))
        await page.click('.rating-ranking-view')
        await page.click('body > div.popup._type_map-hint._position_bottom > div > div > div:nth-child(2)')
        await page.waitForSelector('div.business-card-view__main-wrapper')
        const res = await page.evaluate(() => {
            let res = []
            for (let i = 0; i < 50; i++){
                if (document.querySelectorAll('.business-reviews-card-view__review')[i] != undefined || document.querySelectorAll('.business-reviews-card-view__review')[i] != null) {
                    document.querySelectorAll('.business-reviews-card-view__review')[i].scrollIntoView()
                }
                if (document.querySelectorAll('.commentator-entry-view__expand')[i]) {
                    
                    if (document.querySelectorAll('.commentator-entry-view__expand')[i].innerText === 'посмотреть комментарии') {
                        document.querySelectorAll('.commentator-entry-view__expand')[i].click()
                        res.push(document.querySelector('.commentator-view') ? document.querySelector('.commentator-view').innerHTML : ' ')
                    }
                }
            } 
            document.querySelectorAll('.business-reviews-card-view__review')[0].scrollIntoView() 
            return res
        })
        console.log(res)
        await new Promise(r => setTimeout(r, 3000))
         
        
        const result = await page.evaluate((company) => {
            let comments = []
 
            function getMonth(date){
                let month = ['январ', 'феврал', 'март', 'апрел', 'ма', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр']
                for (let i=0; i<12; i++){
                    if (date.includes(month[i])) return ((i+1) < 10 ? '0'+(i+1) : (i+1))
                }
                return ''
            }

            let totalSearchResults = document.querySelectorAll('.business-review-view__info')

            for (let commentElement of totalSearchResults) {
                let divPhoto = commentElement.querySelector('div.user-icon-view__icon')
                var photoUser
                if (divPhoto){
                    if (divPhoto.innerHTML === "") {
                        photoUser = divPhoto.style.backgroundImage.slice(5).replace('")', '')
                    } else{ photoUser =''}
                }   
                
                let nameUser = commentElement.querySelector('div.business-review-view__author span') ? commentElement.querySelector('div.business-review-view__author span').innerText : ''
                let date = commentElement.querySelector('span.business-review-view__date span') ? commentElement.querySelector('span.business-review-view__date span').innerText : ""
                date = (Number(date.substring(date.length - 4, date.length)) ? date.substring(date.length - 4, date.length) : '2021')+'-'+ getMonth(date) + '-'+ (Number(date.slice(0, 2))<10 ? '0'+Number(date.slice(0, 2)) : Number(date.slice(0, 2)))
                let rating = 5 - commentElement.querySelectorAll('div.business-rating-badge-view__stars span.business-rating-badge-view__star._empty').length
                let textReview = commentElement.querySelector('span.business-review-view__body-text') ? commentElement.querySelector('span.business-review-view__body-text').innerText : ''
                let photos, photosReview = []

                if (commentElement.querySelector('div.carousel__content') === null) {photos = ''} else {
                    photos = commentElement.querySelector('div.carousel__content').querySelectorAll('div.carousel__item')
                    for (let photo of photos) {
                        photosReview.push(photo.querySelector('div.business-review-photos__item-img').style.backgroundImage.slice(5).replace('")', ''))
                    }
                } 
                let check = commentElement.querySelector('.cmnt-item-header__officiality-text') ? commentElement.querySelector('.cmnt-item-header__officiality-text').innerText : ''
                let companyResponses = ''
                if (check.includes("Официальный ответ")) {
                    companyResponses += (check.replace("Официальный ответ", '') + " \n ")
                    companyResponses += (commentElement.querySelector('.cmnt-item__message') ? commentElement.querySelector('.cmnt-item__message').innerText : '')
                }
                companyResponses = companyResponses === '' ? null : companyResponses

                let comment = {
                    company: company,
                    date: date,
                    rating: rating,
                    textReview: textReview,
                    nameUser: nameUser, 
                    photoUser: photoUser, 
                    photosReview: String(photosReview),
                    site: "yandex",
                    companyResponses: companyResponses
                } 
                if (textReview != '') comments = comments.concat(comment)
            }
            return comments
        }, company) 
        sendReviews(result)
    } catch(e){console.log(e)}
    await page.close()
}

// GOOGLE
async function parsingGoogle(url, company) {
    const browser = await puppeteer.launch({   
        headless: true,   
        defaultViewport: null,   
    })
    const page = await browser.newPage() 
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    try{ 
        await page.waitForSelector('div.review-dialog-body') 
        await new Promise(r => setTimeout(r, 2000))
        await page.evaluate(() => {
            if (document.querySelector('div[data-sort-id="newestFirst"]')) document.querySelector('div[data-sort-id="newestFirst"]').click()
        }) 
        await new Promise(r => setTimeout(r, 2000)) 

        const result = await page.evaluate((company) => {
            function getDateAgo(line) {
                let count = Number(line.substring(0, 2)) ? Number(line.substring(0, 2)) : 1
                let date = new Date()
                let days = getDays(line, count)
                date.setDate(date.getDate() - days)
                return date.toISOString().substring(0, 10)
            }
            function getDays(type, count) {
                if (type.includes('час')) {return 0}
                if (type.includes('дн')) {return count}
                if (type.includes('месяц')) {return count * 30}
                if (type.includes('год')) {return count * 365}
                return 0
            }

            let totalSearchResults = document.querySelectorAll('div.WMbnJf.vY6njf.gws-localreviews__google-review')
            let comments = []

            for (let commentElement of totalSearchResults) {
                let nameUser = commentElement.querySelector('div.TSUbDb a').innerText
                let photoUser = commentElement.querySelector('a img') ? commentElement.querySelector('a img').getAttribute('src') : ''
                let rating = Number(commentElement.querySelector('span.Fam1ne.EBe2gf').getAttribute('aria-label').slice(8).replace(',0 из 5,', ''))
                let date = commentElement.querySelector('span.dehysf.lTi8oc').innerText
                date = getDateAgo(date)
                
                if (commentElement.querySelector('span.mvwN6e a.review-more-link')) commentElement.querySelector('span.mvwN6e a.review-more-link').click()
                let textReview = (commentElement.querySelector('div.Jtu6Td').innerHTML.split('span').length - 1 ) > 2 ? commentElement.querySelector('span.review-full-text').innerText : commentElement.querySelector('div.Jtu6Td span').innerText
                
                var photosReview = []
                if (commentElement.querySelector('div.EDblX.DAVP1')) {
                    let divphotos = commentElement.querySelectorAll('div.JrO5Xe')
                    for (let photo of divphotos){
                        photo = photo.style.backgroundImage.slice(5).replace('")', '')
                        photosReview.push(photo)
                    }
                }
                var companyResponses = document.querySelector('.LfKETd') ? document.querySelector('.LfKETd').innerText : ''
                if (companyResponses!='' && companyResponses.includes("Ответ владельца")){
                    companyResponses.replace("Ответ владельца", '')
                } else companyResponses = null
                
                let comment = {
                    company: company,
                    date: date,
                    rating: rating,
                    textReview: textReview,
                    nameUser: nameUser, 
                    photoUser: photoUser, 
                    photosReview: String(photosReview),
                    site: "google",
                    companyResponses: companyResponses
                }
                if (textReview != '') comments = comments.concat(comment)
            }
            return comments
        }, company)  
        sendReviews(result)
    } catch(e){console.log(e)}
    await browser.close()
}

//2GIS
async function parsing2gis(url, company) {
    const browser = await puppeteer.launch({ 
        headless: true, 
        defaultViewport: null,
    })
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    try{
        await page.waitForSelector('div._18lzknl') 

        const result = await page.evaluate((company) => {
            function getMonth(date){
                let month = ['январ', 'феврал', 'март', 'апрел', 'ма', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр']
                for (let i=0; i<12; i++){
                    if (date.includes(month[i])) return ((i+1) < 10 ? '0'+(i+1) : (i+1))
                }
                return ''
            }
            function getDate(date) {
                if (date === 'сегодня') {
                    let dateL = Date.now()
                    date = new Date(dateL)
                    date = date.toISOString().substring(0, 10)
                } else {
                    date = date.replace(', отредактирован', '')
                    date = date.substring(date.length - 4, date.length)+'-'+ getMonth(date) + '-'+ (Number(date.slice(0, 2))<10 ? '0'+Number(date.slice(0, 2)) : Number(date.slice(0, 2)))
                } 
                return date
            }

            let totalSearchResults = document.querySelectorAll('div._11gvyqv') 
            let comments = []
             
            for (let commentElement of totalSearchResults) { 
                let photoUser = commentElement.querySelector('div._1dk5lq4') ? commentElement.querySelector('div._1dk5lq4').style.backgroundImage.slice(5).replace('")', '') : ''
                let nameUser = commentElement.querySelector('span._16s5yj36').innerText
                let date = getDate(commentElement.querySelector('div._4mwq3d').innerText)
                
                let textReview = commentElement.querySelector('._5s35n') ? commentElement.querySelector('._5s35n').innerText + '\n' : ''
                textReview += commentElement.querySelector('a._1it5ivp') ? commentElement.querySelector('a._1it5ivp').innerText : (commentElement.querySelector('a._ayej9u3') ? commentElement.querySelector('a._ayej9u3').innerText : '') 
                let rating = commentElement.querySelector('div._1fkin5c').children.length

                var photosReview = []
                var divPhotos = commentElement.querySelectorAll('img')
                if (divPhotos.length != 0) {
                    for (let photo of divPhotos){ 
                        let url = photo.currentSrc
                        photosReview.push(url)
                    }
                } 
                let companyResponses = ''
                if (commentElement.querySelector('._nqaxddm')){
                    let name = commentElement.querySelector('._1cf08aj') ? commentElement.querySelector('._1cf08aj').innerText.split(' ') : ['']
                     if (name[0] === company.split(' ')[0]) {
                        companyResponses += (commentElement.querySelector('._1fw4r5p') ? commentElement.querySelector('._1fw4r5p').innerText.replace(', официальный ответ', '') + '\n' : '')
                        companyResponses += (commentElement.querySelector('._j1il10') ? commentElement.querySelector('._j1il10').innerText : '')
                    } 
                } else companyResponses = null
                
                let comment = {
                    company: company,
                    date: date,
                    rating: rating,
                    textReview: textReview,
                    nameUser: nameUser,
                    photoUser: photoUser,
                    photosReview: String(photosReview),
                    site: "2gis",
                    companyResponses: companyResponses
                }
                if (commentElement.querySelector('a._ayej9u3') || commentElement.querySelector('a._1it5ivp')) comments = comments.concat(comment)
            }
            return comments
        }, company) 
        sendReviews(result)
    } catch(e){console.log(e)}
    await browser.close()
}

//TRIPADVISOR
async function parsingTripadvisor(url, company) {
    const browser = await puppeteer.launch({ 
        headless: true, 
        defaultViewport: null,
    })
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    try{
        await page.waitForSelector('div.page') 

        const result = await page.evaluate((company) => {
            function getMonth(date){
                let month = ['январ', 'феврал', 'март', 'апрел', 'ма', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр']
                for (let i=0; i<12; i++){
                    if (date.includes(month[i])) return ((i+1) < 10 ? '0'+(i+1) : (i+1))
                }
                return ''
            }
            var comments = []
            let totalSearchResults = document.querySelectorAll('div.review-container')
             
            for (let commentElement of totalSearchResults) {
                let photoUser = commentElement.querySelector('div.ui_avatar.resp img.basicImg') ? commentElement.querySelector('div.ui_avatar.resp img.basicImg').getAttribute('data-lazyurl') : ''
                let nameUser = commentElement.querySelector('div.info_text.pointer_cursor div').innerText
                let date = commentElement.querySelector('span.ratingDate').getAttribute('title')
                date = date.substring(date.length - 7, date.length-3)+'-'+ getMonth(date) + '-'+ (Number(date.slice(0, 2))<10 ? '0'+Number(date.slice(0, 2)) : Number(date.slice(0, 2)))
                let line = commentElement.querySelector('span.ui_bubble_rating').getAttribute('class')
                let rating = line.slice(line.length - 2).replace('0', '')
                let part1, part2, part3
                part1 = commentElement.querySelector('span.noQuotes') ? commentElement.querySelector('span.noQuotes').innerText + ". " : ''
                part2 = commentElement.querySelector('p.partial_entry') ? commentElement.querySelector('p.partial_entry').innerText.replace('...', ' ') : ''
                part3 = commentElement.querySelector('span.postSnippet') ? commentElement.querySelector('span.postSnippet').innerText: ''
                let textReview = part1 + part2 + part3

                let photosReview = []
                if (commentElement.querySelectorAll('span.imgWrap img')) {
                    for (let photo of commentElement.querySelectorAll('span.imgWrap img')){
                        photo = photo.getAttribute('data-lazyurl')
                        photosReview.push(photo)
                    }
                }
                let companyResponses = ''
                if(commentElement.querySelector('.mgrRspnInline')){
                    companyResponses += (commentElement.querySelector('.mgrRspnInline .responseDate') ? commentElement.querySelector('.mgrRspnInline .responseDate').innerText + " \n " : '')
                    companyResponses += (commentElement.querySelector('.mgrRspnInline .partial_entry') ? commentElement.querySelector('.mgrRspnInline .partial_entry').innerText : '')
                } else companyResponses = null
                
                let comment = {
                    company: company,
                    date: date,
                    rating: rating,
                    textReview: textReview,
                    nameUser: nameUser,
                    photoUser: photoUser,
                    photosReview: String(photosReview),
                    site: "tripadvisor",
                    companyResponses: companyResponses
                } 
                if (textReview != '') comments = comments.concat(comment)
            }
            return comments
        }, company) 
        sendReviews(result)
        //console.log(result)
    } catch(e){console.log(e)}
    await browser.close()
}

function sendReviews(reviews) {
    console.log(reviews)
    let data = JSON.stringify(reviews)
    store.postReviewsParsed(data).then(response => {
        console.log('msg: ', response.data.msg)
    }).catch(e => {
        console.log(e)
    }) 
}