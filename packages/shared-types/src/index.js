export function createAppDescriptor(id, displayName) {
    return {
        id,
        displayName,
        stage: 'skeleton',
    };
}
export function createHealthResponse(service, version) {
    return {
        status: 'ok',
        service,
        stage: 'skeleton',
        version,
    };
}
export * from './fixtures.js';
export * from './briefing.js';
export * from './reporting.js';
export * from './resolve.js';
export * from './store.js';
export * from './support.js';
//# sourceMappingURL=index.js.map