import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import * as aws from "aws-sdk";
import fetch from "node-fetch";

const s3 = new aws.S3();

export const main = (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  console.log("event 👉", event);

  return new Promise((resolve) => {
    fetch("https://belev.dev/sitemap.xml")
      .then((res) => res.text())
      .then((sitemapXml) => {
        console.log(sitemapXml);
        s3.putObject(
          {
            Bucket: "playground-bucket2",
            Key: "sitemap.xml",
            Body: sitemapXml,
          },
          (err, data) => {
            if (err) {
              resolve({
                body: `Error: ${JSON.stringify(err)}`,
                statusCode: 200,
              });
            } else {
              resolve({
                body: `Success: ${JSON.stringify(data)}`,
                statusCode: 200,
              });
            }
          }
        );
      });
  });
};
