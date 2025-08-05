FROM nodered/node-red:4.1.0-22

# package 
USER root

RUN npm i node-red-debugger

COPY ./ /package_src/
RUN cd /package_src/ && npm install
    

RUN npm install /package_src/


# defaults
USER node-red

#ENTRYPOINT ["./entrypoint.sh"]
ENTRYPOINT ["./entrypoint.sh", "--settings", "/data/config.js"]

