export const isFatal = (fatal: boolean, severity: any) => fatal || severity === 2;

export const getUniqueMessages = (messages: any[]) => {
  const jsonValues = messages.map((m: any) => JSON.stringify(m));
  const uniuqeValues = jsonValues.reduce((accum, curr) => {
      if (accum.indexOf(curr) === -1) {
          accum.push(curr);
      }
      return accum;
  }, []);

  return uniuqeValues.map(v => JSON.parse(v));
};

export const calculateErrors = (messages: any[]) =>
  messages.reduce((acc,  { fatal, severity }) => isFatal(fatal , severity) ? acc + 1 : acc, 0);

export const calculateWarnings = (messages: any[]) =>
  messages.reduce((acc,  { fatal, severity }) => !isFatal(fatal , severity) ? acc + 1 : acc, 0);


export const getUniqueIssues = (issues: any[]) =>
  issues.map(({ messages, ...restProps }) => {
    const uniqueMessages = getUniqueMessages(messages);
    const warningCount = calculateWarnings(uniqueMessages);
    const errorCount = calculateErrors(uniqueMessages);

    return {
        ...restProps,
        errorCount,
        messages: uniqueMessages,
        warningCount,
    };
  });

module.exports = {
  getUniqueIssues,
  getUniqueMessages,
  isFatal,
};
