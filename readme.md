The structure of the JSON Object that gets sent to the client.

{
    "querydata": {
        "queriedartist": "queriedartistname",
        "relatedartists": [
            {
                "artistname": "namestr",
                "songs": [
                    {
                        "songname": "songnamestr",
                    },
                    {
                        "songname": "songnamestr",
                    }
                ]
            }
        ],
        "trackuris": []
    }
}