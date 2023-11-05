
  // Function to dynamically add drug input fields
  function addDrugInput() {
    const div = document.createElement('div');
    div.classList.add('drug-input');
    div.innerHTML = `
      <input type="text" class="drug" placeholder="Enter generic drug name">
      <button type="button" class="remove" onclick="removeDrugInput(this)">Remove</button>
    `;

    const inputField = div.querySelector('.drug');
    inputField.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        checkInteractions();
      }
    });

    document.getElementById('drugInputs').appendChild(div);
  }

  // Function to remove a drug input field
  function removeDrugInput(button) {
    button.parentElement.remove();
  }

  async function getRxcui(drugName) {
    try {
      const response = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${drugName}`);
      const data = await response.json();
      if (data.idGroup.rxnormId && data.idGroup.rxnormId.length > 0) {
        return data.idGroup.rxnormId[0]; // Get the first RxCUI in the array
      } else {
        throw new Error(`RxCUI for ${drugName} not found.`);
      }
    } catch (error) {
      console.error(error);
      alert(error.message);
      return null; // Return null if there's an error
    }
  }

  async function checkInteractions() {
    clearPreviousSummary();
    // Get all drug input values
    const drugInputs = document.querySelectorAll('.drug');
    const drugNames = Array.from(drugInputs).map(input => input.value.trim()).filter(Boolean);

    if (drugNames.length < 2) {
      alert('Please enter at least two drug names.');
      return;
    }

    // Show loading indicator
    document.querySelector('.loading').style.display = 'block';

    // Get RxCUIs for all drugs
    const rxcuis = await Promise.all(drugNames.map(getRxcui));

    if (rxcuis.includes(null)) {
      // Hide loading indicator
      document.querySelector('.loading').style.display = 'none';
      return; // If any RxCUIs are null, return early
    }

    // Check interactions
    try {
      const interactionResponse = await fetch(`https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${rxcuis.join('+')}`);
      interactionData = await interactionResponse.json();
      displayInteractions(interactionData);
    } catch (error) {
      console.error(error);
      alert('Failed to check interactions. Please try again later.');
    } finally {
      // Hide loading indicator
      document.querySelector('.loading').style.display = 'none';
    }

  // Collect interaction descriptions from the interactionData
   let descriptions = [];
   if (interactionData.fullInteractionTypeGroup) {
     interactionData.fullInteractionTypeGroup.forEach(group => {
       group.fullInteractionType.forEach(interaction => {
         interaction.interactionPair.forEach(pair => {
           descriptions.push(pair.description);
         });
       });
     });
   }

   // Combine descriptions into a single text
   let combinedDescriptions = descriptions.join(' ');

   if (descriptions.length > 0) {
     try {
       let simplifiedDescription = await simplifyInteractionDescription(combinedDescriptions);

       // Append the result below the interactions table
       let summaryDiv = document.createElement('div');
       summaryDiv.id = 'summaryDiv';
       summaryDiv.innerHTML = `
         <h2>AI Recommendations</h2>
         <p>${simplifiedDescription}</p>
       `;
       document.body.appendChild(summaryDiv);
     } catch (error) {
       console.error('Error getting AI recommendations', error);
       // Append error message below the interactions table
       let summaryDiv = document.createElement('div');
       summaryDiv.id = 'summaryDiv';
       summaryDiv.innerHTML = `
         <h2>AI Recommendations</h2>
         <p>An error occurred while trying to get the summary. Please try again later.</p>
       `;

       document.body.appendChild(summaryDiv);
     }
   }

   // Hide loading indicator
   document.querySelector('.loading').style.display = 'none';
  }

  function displayInteractions(data) {
    const resultDiv = document.getElementById('interactionResults');
    resultDiv.innerHTML = ''; // Clear previous results

    if (data.fullInteractionTypeGroup) {
      let table = `<table class="interaction">
                     <tr>
                       <th>Interaction</th>
                     </tr>`;
      data.fullInteractionTypeGroup.forEach((group) => {
        group.fullInteractionType.forEach((interaction) => {
          interaction.interactionPair.forEach((pair) => {
            table += `<tr>
                        <td>${pair.description}</td>
                      </tr>`;
          });
        });
      });
      table += `</table>`;
      resultDiv.innerHTML = table;
    } else {
      resultDiv.innerHTML = '<p>No interactions found or some drugs not recognized.</p>';
    }
  }


  // Function to simplify drug interaction description using the GPT API
  async function simplifyInteractionDescription(description) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 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' // Replace with your actual API key
        },
        body: JSON.stringify({
          "model": "gpt-3.5-turbo",
          "messages": [
            {
              "role": "system",
              "content": "You're a drug expert. Produce a patient-friendly eloboration for this specific interaction in a simple and digestable manner. Then provide recommendations to optimize the combined usage of the drugs to minimize harm. minimize conversational phrases. Limit to 10 lines."
            },
            {
              "role": "user",
              "content": description
            }
          ]
        })
      });

      const data = await response.json();
      return data.choices[0].message.content; // Assuming you want to grab the content of the first message
    } catch (error) {
      console.error('Error simplifying interaction description:', error);
      return "An error occurred while trying to simplify the description.";
    }
  }

  // Modified function to display interactions with simplified descriptions
  async function displayInteractionsWithSimplification(data) {
    const resultDiv = document.getElementById('interactionResults');
    resultDiv.innerHTML = ''; // Clear previous results

    if (data.fullInteractionTypeGroup) {
      let table = `<table>
                     <tr>
                       <th>Interaction</th>
                       <th>Simplified Explanation</th>
                     </tr>`;
      for (const group of data.fullInteractionTypeGroup) {
        for (const interaction of group.fullInteractionType) {
          for (const pair of interaction.interactionPair) {
            const simplifiedDescription = await simplifyInteractionDescription(pair.description);
            table += `<tr>
                        <td>${pair.description}</td>
                        <td>${simplifiedDescription}</td>
                      </tr>`;
          }
        }
      }
      table += `</table>`;
      resultDiv.innerHTML = table;
    } else {
      resultDiv.innerHTML = '<p>No interactions found or some drugs not recognized.</p>';
    }
  }

  function clearPreviousSummary() {
    const previousSummary = document.querySelector('#summaryDiv');
    if (previousSummary) {
      previousSummary.remove();
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
  // Add event listener to existing drug input fields
  document.querySelectorAll('.drug').forEach(function(inputField) {
    inputField.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault(); // Prevent default form submission
        checkInteractions();
      }
    });
  });
});