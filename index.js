import express from "express";
import cors from "cors";
import { sendEmails } from "./service/emailService.js";
import { connectDb } from "./db/dbConnect.js";
import Email from "./models/emails.model.js";
import dotenv from "dotenv";
import {
  generateFutureDate,
  insertDailyEmail,
} from "./service/insertNewFututerEmail.js";
import { deleteDailyEmail } from "./service/deleteDailyEmail.js";
import DailyEmail from "./models/futureDailyEmails.js";
import WhichDaySent from "./models/whichDaySent.js";
import { clerkClient } from "./service/clerkClient.js";

dotenv.config();
const app = express();

// express middleware
app.use(express.json());
app.use(cors());

// initialize the all services
async function init() {
  await connectDb();
}

init();

app.get("/", (req, res) => {
  res.send("server running update new 1..");
});

const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const monthsOfYear = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDateMessage() {
  const today = new Date();
  const dayOfWeek = daysOfWeek[today.getDay()];
  const month = monthsOfYear[today.getMonth()];
  const day = today.getDate();
  return `${month} ${day} — Happy ${dayOfWeek}`;
}
// Send email route
app.post("/send-email", async function (req, res) {
  try {
    const { email } = req.body;
    const aiImageGeneratorData = await fetch(
      "https://quote-generator-rvg3.onrender.com/generate-quote-image"
    );
    const aiGeneratedImageResponse = await aiImageGeneratorData.json();

    const result = await sendEmails(
      [email],
      aiGeneratedImageResponse?.message,
      aiGeneratedImageResponse?.cloudinaryResponse?.secure_url,
      aiGeneratedImageResponse?.subject,
      formatDateMessage()
    );

    if (!result) {
      return res.status(400).json({ message: "Email send unsuccessful" });
    }

    // Add email to the database if sent successfully
    await Email.create({ email });
    console.log("new email add ", email);

    res.json({ message: "Email sent successfully", data: result });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// add emails
app.post("/add-emails", async (req, res) => {
  try {
    const { emails } = req.body;

    if (!Array.isArray(emails)) {
      return res
        .status(400)
        .json({ message: "Invalid input format, expected an array of emails" });
    }

    const emailDocs = emails.map((email) => ({ email }));
    console.log(emailDocs);
    // Insert emails into the database
    const data = await Email.insertMany(emailDocs, { ordered: false });
    console.log(data);
    res.status(200).json({ message: "Emails added successfully" });
  } catch (error) {
    if (error.code === 11000) {
      res
        .status(400)
        .json({ message: "Some emails already exist in the database" });
    } else {
      res.status(500).json({ message: "Server error", error });
    }
  }
});

// console.log(insertDailyEmail());
// 66f5178af8af399b85d09a5b
// deleteDailyEmail("66f5178af8af399b85d09a5b");

function getCurrentTime() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";

  // Convert to 12-hour format
  const formattedHours = hours % 12 || 12; // If hours is 0, set it to 12
  const formattedMinutes = minutes < 10 ? "0" + minutes : minutes; // Add leading zero if needed

  return `${formattedHours}:${formattedMinutes} ${ampm}`;
}

// Example usage
const currentTime = getCurrentTime();
console.log(currentTime); // Outputs: "11:24 PM"

const sendEmailsEveryDay = async () => {
  try {
    console.log("finding email template on db");
    const DailyEmailTemplet = await DailyEmail.find();
    console.log(DailyEmailTemplet[0]);

    console.log("finding emails on db");
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 10);

    // const emails = await Email.find({ createdAt: { $lte: sevenDaysAgo } })
    //   .select("email -_id")
    //   .lean();
       



     // Fetch Clerk users' emails that are 10 days old or older
    const clerkUsers = await clerkClient.users.getUserList({
      limit: 500, // Adjust this limit as needed
    });

    console.log(clerkUsers)
    console.log(sevenDaysAgo,"--> ",new Date(new Number("1729200518931")))

    const emails = clerkUsers.data
      .filter(user => new Date(new Number(user.createdAt)) <= sevenDaysAgo)
      .map(user => user.emailAddresses[0].emailAddress);
    
      console.log("clerk emails --> ",emails)
    // ["riteshdhapate1@gmail.com"],
    if (emails.length > 0) {
      await sendEmails(
        ["riteshdhapate1@gmail.com"],
        DailyEmailTemplet[0].message,
        DailyEmailTemplet[0].image,
        DailyEmailTemplet[0].title,
        generateFutureDate(0)
      );
      await insertDailyEmail();
      console.log("deleting daily email [0] index");
      deleteDailyEmail(DailyEmailTemplet[0]._id);
    } else {
      console.log("No users older than 7 days found. Skipping send.");
    }
  } catch (error) {
    console.log(error);
  }
};

function addTwoMinutes(timeString) {
  // Parse the time string
  const [time, period] = timeString.split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  // Convert to 24-hour format if PM
  if (period === "PM" && hours !== 12) {
    hours += 12;
  } else if (period === "AM" && hours === 12) {
    hours = 0;
  }

  // Add 2 minutes
  minutes += 2;

  // Handle minute overflow
  if (minutes >= 60) {
    hours += 1;
    minutes -= 60;
  }

  // Handle hour overflow
  hours = hours % 24;

  // Convert back to 12-hour format
  let newPeriod = "AM";
  if (hours >= 12) {
    newPeriod = "PM";
    if (hours > 12) {
      hours -= 12;
    }
  }
  if (hours === 0) {
    hours = 12;
  }

  // Format the result
  const formattedHours = hours.toString().padStart(2, "0");
  const formattedMinutes = minutes.toString().padStart(2, "0");

  return `${formattedHours}:${formattedMinutes} ${newPeriod}`;
}

const getCurrentDay = () => {
  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const today = new Date(); // Get the current date
  const dayIndex = today.getDay(); // Get the index of the day (0 for Sunday, 1 for Monday, etc.)
  return daysOfWeek[dayIndex]; // Return the name of the day
};

let emailSentTime = "11:43 AM";
let ifSent = false;
setInterval(async () => {
  const currentTime = getCurrentTime();
  console.log(currentTime, " => ", emailSentTime," flag -->",ifSent);
  if (currentTime == emailSentTime && ifSent == false) {
    const currentDay = getCurrentDay();
    const result = await WhichDaySent.findOne();
    if (result.days.includes(currentDay)) {
      ifSent = true;
      console.log("cll");
      sendEmailsEveryDay();
      console.log(`Emails are scheduled to be sent on ${currentDay}`);
      setTimeout(() => {
        ifSent=false;
        console.log("flag set false");
      }, 1000*60);
    } else {
      console.log(`No emails scheduled for ${currentDay}`);
    }
  }
}, 1000);

app.post("/change-auto-email-sent-time", (req, res) => {
  try {
    const { newTime } = req.body;
    emailSentTime = newTime;
    res.send("auto email sent time updated");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/newsletter-data", async (req, res) => {
  try {
    const DailyEmailTemplet = await DailyEmail.find();
    const currentTime = getCurrentTime();
    res.json({
      DailyEmailTemplet,
      serverCurrentTime: currentTime,
      emailSentTime,
      currentDay: getCurrentDay(),
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/set-which-days-email-sent", async (req, res) => {
  try {
    const { days } = req.body;

    // Validate that days is an array and contains valid days
    if (
      !Array.isArray(days) ||
      days.some(
        (day) =>
          ![
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ].includes(day)
      )
    ) {
      return res.status(400).json({ error: "Invalid days provided" });
    }

    // Create a new record or update an existing one (you can adjust logic here as needed)
    const result = await WhichDaySent.findOneAndUpdate(
      {}, // Assuming there's only one document for which days emails are sent
      { days },
      { new: true, upsert: true } // Create a new document if one doesn't exist
    );

    res.status(200).json({ message: "Days successfully updated", result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/get-which-days-email-sent", async (req, res) => {
  try {
    // Fetch the document that contains the days
    const result = await WhichDaySent.findOne();

    if (!result) {
      return res.status(404).json({ message: "No days found" });
    }

    // Respond with the days
    res.status(200).json({ days: result.days });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete email route
app.delete("/email/:id", async (req, res) => {
  try {
    const { id } = req.params; // Extract the ID from the route parameters
    const deletedEmail = await Email.findByIdAndDelete(id); // Delete email by ID

    if (!deletedEmail) {
      return res.status(404).json({ message: "Email not found" });
    }

    return res
      .status(200)
      .json({ message: "Email deleted successfully", deletedEmail });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
});


app.post("/delete-email-post",async(req, res) => {
  try {
    const {id}= req.body;
    await insertDailyEmail();
    console.log("deleting daily email ",id);
     await deleteDailyEmail(id);
     res.send("email post deleted successfully"); 
  } catch (error) {
    console.log(error);
    res.status(500).json({message:"email post deleted failed"});
  }
});

// listen the app on 2000 port
app.listen(process.env.PORT || 2000, () => {
  console.log(`server listening on port ${process.env.PORT}`);
});
