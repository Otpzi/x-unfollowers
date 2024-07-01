function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function navigateAndWait(url, waitTime) {
    window.location.href = url;
    await sleep(waitTime);
}

async function extractFollowersHandles(followerHandlesSet) {
    let followerElements = document.querySelectorAll('div[data-testid="UserCell"]'); // Example selector, adjust as needed

    followerElements.forEach(element => {
        let handleElement = element.querySelector('a[href^="/"]');
        if (handleElement) {
            let followerHandle = handleElement.getAttribute('href').slice(1); // Remove the leading '/'
            followerHandlesSet.add(followerHandle);
        }
    });
}

async function loadAndExtractFollowers() {
    let followerHandles = new Set(); // Using a Set to automatically handle unique values
    let previousSize = 0;
    let attempts = 0;
    const maxAttempts = 3; // Max attempts to try fetching new followers after no new ones are detected

    while (true) {
        window.scrollBy(0, window.innerHeight);
        await sleep(100); // Adjust the sleep time as needed for page load performance

        await extractFollowersHandles(followerHandles);

        if (followerHandles.size === previousSize) {
            attempts++;

            // wait for loading 
            await sleep(2000)

            if (attempts >= maxAttempts) {
                // Stop if no new followers are added after several attempts
                break;
            }
        } else {
            attempts = 0; // Reset attempts if new followers are found
        }

        previousSize = followerHandles.size;
    }

    return Array.from(followerHandles); // Convert the Set to an Array to return
}



async function analyzeAndStoreFollowers(followerHandles) {
    // This function now does the job of analyzing followers and storing the result
    chrome.storage.local.get(['previousFollowers'], function (result) {
        const previousFollowers = result.previousFollowers || [];
        const newFollowers = followerHandles.filter(follower => !previousFollowers.includes(follower));
        const unfollowers = previousFollowers.filter(follower => !followerHandles.includes(follower));

        let output = `# Total Followers: ${followerHandles.length}<br>`;

        if (unfollowers.length > 0) {
            output += `<br># ${unfollowers.length} unfollowers<br><br>`;
            unfollowers.forEach(unfollower => {
                output += `<a href="https://x.com/${unfollower}" target="_blank">https://x.com/${unfollower}</a><br>`;
            });
        }

        if (newFollowers.length > 0) {
            output += `<br># ${newFollowers.length} new followers<br><br>`;
            newFollowers.forEach(follower => {
                output += `<a href="https://x.com/${follower}" target="_blank">https://x.com/${follower}</a><br>`;
            });
        }

        if (unfollowers.length === 0 && newFollowers.length === 0) {
            output += "<br>No changes in followers.<br>";
        }

        chrome.runtime.sendMessage({ response: output });
        chrome.storage.local.set({ 'x-unfollowers': output, 'previousFollowers': followerHandles }, function () {
            console.log('Followers analysis stored.');
        });
    });
}


async function main() {
    if (window.location.href !== "https://x.com/km1k92/followers") {
        alert("Goto https://x.com/km1k92/followers");
        console.log("Not on the specified URL, script will not run.");
        return;
    }

    // remove aside "who to follow"
    // Use querySelector to find the element with the specific aria-label
    var element = document.querySelector('aside[aria-label="Who to follow"]');

    // If the element exists, remove it from the DOM
    if (element) {
        element.parentNode.removeChild(element);
    }


    window.scrollTo(0, 0);
    await sleep(1000);

    let allFollowers = await loadAndExtractFollowers();
    await analyzeAndStoreFollowers(allFollowers);
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === "bustEm") {
        main();
    }
});
