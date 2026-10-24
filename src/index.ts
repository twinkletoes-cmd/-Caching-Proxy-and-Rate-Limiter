import express from "express";
import axios from "axios";
import NodeCache from "node-cache";
import rateLimit from "express-rate-limit";

const globalLimiter = rateLimit({
  windowMs: 1000 * 60,
  limit: 10,
  message: {
    status: 429,
    error: "Too many requests, please try again",
  },
});

const app = express();
app.use(express.json());

const timeToLive = 60;
const cache = new NodeCache({ stdTTL: timeToLive });
const baseUrl = "https://jsonplaceholder.typicode.com";

app.get("/proxy/*endpoint", async (req, res) => {
  const wildcardPath = req.params.endpoint;
  const formattedPath = Array.isArray(wildcardPath)
    ? wildcardPath.join("/")
    : wildcardPath;
  const fullUrl = new URL(formattedPath, baseUrl);
  const targetUrl = fullUrl.toString();
  console.log(targetUrl);

  console.log(req.originalUrl);
  const cacheKey = req.originalUrl;
  if (cache.has(cacheKey)) {
    console.log("Hit");
    res.set("Cache-control", `public, max-age=${timeToLive}`);
    return res.status(200).send(cache.get(cacheKey));
  } else {
    globalLimiter(req, res, async () => {
      try {
        const response = await axios(targetUrl);
        cache.set(cacheKey, response.data);
        res.set("Cache-control", `public, max-age=${timeToLive}`);

        console.log("Miss");
        res.status(200).send(response.data);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response) {
            res.status(error.response.status).send(error.response.data);
          } else if (error.request) {
            console.log("code: ", error.code);
            console.log("message: ", error.message);
            res.status(504).send("Gateway timeout");
          } else {
            res.status(500).send(error.message);
          }
        } else {
          res.status(500).send("This was an error from our side");
        }
      }
    });
  }
});

app.listen(3000, () => {
  console.log("Server is active");
});
