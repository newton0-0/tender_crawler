const axios = require('axios');
const cheerio = require('cheerio');

// Base URL and the target page URL
const baseUrl = 'https://etenders.gov.in';
const url = `${baseUrl}/eprocure/app?page=FrontEndTendersByOrganisation&service=page`;

// Function to extract links that have only integers in their text
async function getLinksWithIntegersOnly(url) {
    try {
        const response = await axios.get(url);
        
        // Check if the request was successful
        if (response.status === 200) {
            let orgCount = 0;
            let individualTenderCount = 0;

            // Extract cookies
            const cookies = response.headers['set-cookie'];
            const jsessionid = cookies.find(cookie => cookie.startsWith('JSESSIONID')).split(';')[0]; // Extract JSESSIONID

            // Load the HTML into cheerio
            const $ = cheerio.load(response.data);
            const links = $('a[href]');

            // Loop through the links to find those where the text is only digits (an integer)
            $(links).each(async (index, link) => {
                const linkText = $(link).text().trim();
                if ($.isNumeric(linkText)) { // Check if the link text is entirely an integer
                    individualTenderCount += parseInt(linkText);
                    orgCount++;

                    // Send a GET request to the individual organization tenders page, including the JSESSIONID cookie
                    const orgTendersResponse = await axios.get(`${baseUrl}${$(link).attr('href')}`, {
                        headers: {
                            Cookie: jsessionid // Send JSESSIONID as a cookie
                        }
                    });

                    if (orgTendersResponse.status === 200) {
                        const orgSoup = cheerio.load(orgTendersResponse.data);
                        const orgLinks = orgSoup('a[href]');
                        
                        orgLinks.each((_, orgLink) => {
                            if (orgSoup(orgLink).attr('href').includes('component=%24DirectLink&page=FrontEndViewTender')) {
                                const tenderDetails = getIndividualTenderDetails(orgSoup(orgLink).attr('href'), jsessionid);
                                console.log(`Processed tender details: ${tenderDetails}`);
                            }
                        });
                    }
                }
            });

            console.log(`Total number of organisation links with only integers in their text: ${orgCount}`);
            console.log('Individual tender count: ', individualTenderCount);
        } else {
            console.error(`Failed to retrieve the page. Status code: ${response.status}`);
        }
    } catch (error) {
        console.error(`Error fetching data: ${error.message}`);
    }
}

// Function to retrieve individual tender details and extract specific data
async function getIndividualTenderDetails(url, jsessionid) {
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    
    try {
        const response = await axios.get(fullUrl, {
            headers: {
                Cookie: jsessionid // Send JSESSIONID as a cookie
            }
        });

        if (response.status === 200) {
            const $ = cheerio.load(response.data);
            const tenderData = {};

            // Extracting data based on the specified classes
            const captions = $('td.td_caption');
            const fields = $('td.td_field');

            // Ensure we have the same number of captions and fields
            $(captions).each((index, caption) => {
                const label = $(caption).text().trim();
                const value = $(fields[index]).text().trim();

                // Store specific required values
                if (label.includes('Tender Reference Number')) {
                    tenderData.tender_reference_number = value;
                } else if (label.includes('Tender ID')) {
                    tenderData.tender_id = value;
                } else if (label.includes('Tender Value in ₹')) {
                    tenderData.tender_title = value;
                } else if (label.includes('Bid Submission End Date')) {
                    tenderData.bid_submission_end_date = value;
                }
            });

            if (Object.keys(tenderData).length > 0) {
                return tenderData; // Return the tender details
            } else {
                console.log(`No relevant data found for: ${fullUrl}`);
                return null;
            }
        } else {
            console.error(`Failed to retrieve the page. Status code: ${response.status}`);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching individual tender details: ${error.message}`);
        return null;
    }
}

// Start the extraction process
getLinksWithIntegersOnly(url);
