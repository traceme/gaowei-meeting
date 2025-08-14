#建立测试基础设施

import { describe, it, expect } from 'vitest';                                                                      │
import request from 'supertest';                                                                                    │
import { app } from '../index';                                                                                     │
                                                                                                             │
describe('Health Check', () => {                                                                                    │
    it('should return 200 for health endpoint', async () => {                                                         │
        const response = await request(app).get('/api/health');                                                         │
        expect(response.status).toBe(200);                                                                              │
        expect(response.body.status).toBe('ok');                                                                        │
    });                                                                                                               │
});   